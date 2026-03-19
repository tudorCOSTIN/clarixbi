import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
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
  constructor(private authService: AuthService) {}

  @Public()
  @Post('callback')
  @ApiOperation({ summary: 'Exchange Auth0 authorization code for JWT tokens' })
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
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
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
      maxAge: 30 * 24 * 60 * 60 * 1000,
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
