import { Body, Controller, Get, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { AuthCallbackDto } from './dto/auth-callback.dto';
import { MagicLinkDto } from './dto/magic-link.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtUser } from './interfaces/jwt-user.interface';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Public()
  @Get('callback')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Handle Auth0 redirect — exchange code, set cookies, redirect to app' })
  async callbackGet(@Query('code') code: string, @Res() res: Response) {
    const appUrl =
      this.configService.get<string>('NEXT_PUBLIC_APP_URL') ||
      this.configService.get<string>('CORS_ORIGIN');
    const defaultLocale = 'ro';

    if (!code) {
      return res.redirect(`${appUrl}/${defaultLocale}/login?error=missing_code`);
    }

    try {
      const auth0Profile = await this.authService.validateAuth0Token(code);
      const { user, isNew } = await this.authService.findOrCreateUser(auth0Profile);
      const tokens = await this.authService.generateTokenPair(user);

      res.cookie('access_token', tokens.access_token, {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'lax',
        maxAge: tokens.expires_in * 1000,
        path: '/',
      });

      res.cookie('refresh_token', tokens.refresh_token, {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      });

      const locale = defaultLocale;
      const redirectPath = isNew ? `/${locale}/connect` : `/${locale}`;
      return res.redirect(`${appUrl}${redirectPath}`);
    } catch {
      return res.redirect(`${appUrl}/${defaultLocale}/login?error=auth_failed`);
    }
  }

  @Public()
  @Post('callback')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Exchange Auth0 authorization code for JWT tokens (API)' })
  async callback(@Body() dto: AuthCallbackDto, @Res({ passthrough: true }) res: Response) {
    const auth0Profile = await this.authService.validateAuth0Token(dto.code);
    const { user, isNew } = await this.authService.findOrCreateUser(auth0Profile);
    const tokens = await this.authService.generateTokenPair(user);

    // Set httpOnly cookie for access token
    res.cookie('access_token', tokens.access_token, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      maxAge: tokens.expires_in * 1000,
      path: '/',
    });

    // Set httpOnly cookie for refresh token
    res.cookie('refresh_token', tokens.refresh_token, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    return {
      data: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        is_new_user: isNew,
      },
    };
  }

  @Public()
  @Post('magic-link')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Send magic link email via Auth0 Passwordless' })
  async magicLink(@Body() dto: MagicLinkDto) {
    await this.authService.sendMagicLink(dto.email);
    return {
      data: { message: 'Magic link sent successfully' },
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user with organizations' })
  async me(@CurrentUser() user: JwtUser) {
    const userData = await this.authService.getUserWithOrgs(user.id);
    return { data: userData };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  async logout(@CurrentUser() user: JwtUser, @Res({ passthrough: true }) res: Response) {
    await this.authService.revokeRefreshToken(user.id);

    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });

    return { data: { message: 'Logged out successfully' } };
  }

  @Public()
  @Post('refresh')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Refresh JWT access token using refresh token' })
  async refresh(
    @Body() body: { refresh_token: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.refreshAccessToken(body.refresh_token);

    res.cookie('access_token', tokens.access_token, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      maxAge: tokens.expires_in * 1000,
      path: '/',
    });

    res.cookie('refresh_token', tokens.refresh_token, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return {
      data: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
      },
    };
  }
}
