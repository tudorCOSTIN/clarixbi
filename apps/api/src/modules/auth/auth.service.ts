import { Injectable, UnauthorizedException, Logger, Inject } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { User } from '../users/entities/user.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { TeamMember, TeamRole } from '../teams/entities/team-member.entity';

interface Auth0UserInfo {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private redis: Redis;

  constructor(
    private configService: ConfigService,
    private jwtService: JwtService,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Organization) private orgRepo: Repository<Organization>,
    @InjectRepository(TeamMember) private teamMemberRepo: Repository<TeamMember>,
    @Inject('BILLING_SERVICE')
    private billingService: { autoEnrollTrial(orgId: string): Promise<void> },
  ) {
    this.redis = new Redis(this.configService.get<string>('auth.redisUrl')!);
  }

  async validateAuth0Token(code: string, redirectUri?: string): Promise<Auth0UserInfo> {
    const domain = this.configService.get<string>('auth.auth0Domain');
    const clientId = this.configService.get<string>('auth.auth0ClientId');
    const clientSecret = this.configService.get<string>('auth.auth0ClientSecret');
    const callbackUrl = redirectUri || this.configService.get<string>('auth.auth0CallbackUrl');

    // Exchange authorization code for tokens
    const tokenResponse = await fetch(`https://${domain}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: callbackUrl,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      this.logger.error(`Auth0 token exchange failed: ${error}`);
      throw new UnauthorizedException('Invalid authorization code');
    }

    const tokens = await tokenResponse.json();

    // Get user info from Auth0
    const userInfoResponse = await fetch(`https://${domain}/userinfo`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      signal: AbortSignal.timeout(10000),
    });

    if (!userInfoResponse.ok) {
      throw new UnauthorizedException('Failed to fetch user info from Auth0');
    }

    return userInfoResponse.json();
  }

  async findOrCreateUser(auth0Profile: Auth0UserInfo): Promise<{ user: User; isNew: boolean }> {
    // Try to find by auth0_id first, then by email
    let user = await this.userRepo.findOne({ where: { auth0_id: auth0Profile.sub } });
    if (user) {
      return { user, isNew: false };
    }

    user = await this.userRepo.findOne({ where: { email: auth0Profile.email } });
    if (user) {
      // Link existing user to Auth0
      user.auth0_id = auth0Profile.sub;
      if (auth0Profile.picture) {
        user.avatar_url = auth0Profile.picture;
      }
      await this.userRepo.save(user);
      return { user, isNew: false };
    }

    // Create new user
    user = this.userRepo.create({
      auth0_id: auth0Profile.sub,
      email: auth0Profile.email,
      name: auth0Profile.name || auth0Profile.email.split('@')[0],
      avatar_url: auth0Profile.picture || null,
    });
    user = await this.userRepo.save(user);

    // Create default organization
    const slug = this.generateSlug(user.name);
    const org = this.orgRepo.create({
      name: `${user.name} Workspace`,
      slug,
    });
    const savedOrg = await this.orgRepo.save(org);

    // Create team membership as owner
    const membership = this.teamMemberRepo.create({
      user_id: user.id,
      org_id: savedOrg.id,
      role: TeamRole.OWNER,
      joined_at: new Date(),
    });
    await this.teamMemberRepo.save(membership);

    this.logger.log(`Created new user ${user.email} with org "${savedOrg.name}"`);

    // Auto-enroll in Pro trial (14 days)
    await this.billingService.autoEnrollTrial(savedOrg.id);

    return { user, isNew: true };
  }

  async generateTokenPair(user: User): Promise<TokenPair> {
    const payload = {
      sub: user.id,
      email: user.email,
      auth0_id: user.auth0_id,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.generateRefreshToken();
    const refreshExpiresIn =
      this.configService.get<number>('auth.refreshTokenExpiresIn') || 2592000;

    // Store refresh token in Redis with last_activity for idle timeout
    await this.redis.set(
      `refresh:${user.id}:${refreshToken}`,
      JSON.stringify({ userId: user.id, createdAt: Date.now(), lastActivity: Date.now() }),
      'EX',
      refreshExpiresIn,
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 900,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<TokenPair> {
    // Find the refresh token in Redis using SCAN (non-blocking, unlike KEYS)
    const keys: string[] = [];
    let cursor = '0';
    do {
      const [nextCursor, batch] = await this.redis.scan(
        cursor,
        'MATCH',
        `refresh:*:${refreshToken}`,
        'COUNT',
        100,
      );
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0' && keys.length === 0);

    if (!keys.length) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const key = keys[0]!;
    const data = await this.redis.get(key);
    if (!data) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const parsed = JSON.parse(data);
    const { userId, lastActivity } = parsed;

    // Idle timeout: 7 days of inactivity → force re-login
    const IDLE_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000;
    if (lastActivity && Date.now() - lastActivity > IDLE_TIMEOUT_MS) {
      await this.redis.del(key);
      throw new UnauthorizedException('Session expired due to inactivity');
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || !user.is_active) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Delete old refresh token
    await this.redis.del(key);

    // Generate new token pair (lastActivity is reset in generateTokenPair)
    return this.generateTokenPair(user);
  }

  async revokeRefreshToken(userId: string): Promise<void> {
    const keys: string[] = [];
    let cursor = '0';
    do {
      const [nextCursor, batch] = await this.redis.scan(
        cursor,
        'MATCH',
        `refresh:${userId}:*`,
        'COUNT',
        100,
      );
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');

    if (keys.length) {
      await this.redis.del(...keys);
    }
  }

  async sendMagicLink(email: string): Promise<void> {
    const domain = this.configService.get<string>('auth.auth0Domain');
    const clientId = this.configService.get<string>('auth.auth0ClientId');
    const clientSecret = this.configService.get<string>('auth.auth0ClientSecret');

    // Get management API token
    const tokenResponse = await fetch(`https://${domain}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        audience: `https://${domain}/api/v2/`,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!tokenResponse.ok) {
      this.logger.error('Failed to get Auth0 management token for magic link');
      throw new UnauthorizedException('Failed to initiate magic link');
    }

    const { access_token } = await tokenResponse.json();

    // Send passwordless email
    const magicLinkResponse = await fetch(`https://${domain}/passwordless/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access_token}`,
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        connection: 'email',
        email,
        send: 'link',
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!magicLinkResponse.ok) {
      const error = await magicLinkResponse.text();
      this.logger.error(`Magic link send failed: ${error}`);
      throw new UnauthorizedException('Failed to send magic link');
    }

    this.logger.log(`Magic link sent to ${email}`);
  }

  async getUserWithOrgs(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const memberships = await this.teamMemberRepo.find({
      where: { user_id: userId },
      relations: ['organization'],
    });

    return {
      ...user,
      organizations: memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        logo_url: m.organization.logo_url,
        role: m.role,
      })),
    };
  }

  private generateRefreshToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private generateSlug(name: string): string {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const suffix = randomBytes(4).toString('hex').substring(0, 8);
    return `${base}-${suffix}`;
  }
}
