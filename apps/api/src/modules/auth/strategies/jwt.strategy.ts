import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';

export interface JwtPayload {
  sub: string; // user.id (UUID)
  email: string;
  auth0_id: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    const auth0Domain = configService.get<string>('auth.auth0Domain');

    const options = {
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: Request & { cookies?: Record<string, string> }) =>
          req?.cookies?.['access_token'] || null,
      ]),
      ignoreExpiration: false,
      algorithms: auth0Domain ? ['RS256'] : ['HS256'],
      ...(auth0Domain
        ? {
            secretOrKeyProvider: passportJwtSecret({
              cache: true,
              rateLimit: true,
              jwksRequestsPerMinute: 5,
              jwksUri: `https://${auth0Domain}/.well-known/jwks.json`,
            }),
            audience: configService.get<string>('auth.auth0Audience'),
            issuer: `https://${auth0Domain}/`,
          }
        : {
            secretOrKey: configService.get<string>('auth.jwtSecret'),
          }),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    super(options as any);
  }

  validate(payload: JwtPayload) {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }
    return {
      id: payload.sub,
      email: payload.email,
      auth0_id: payload.auth0_id,
    };
  }
}
