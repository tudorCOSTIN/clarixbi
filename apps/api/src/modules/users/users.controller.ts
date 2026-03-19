import { Body, Controller, Delete, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtUser } from '../auth/interfaces/jwt-user.interface';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  async getMe(@CurrentUser() user: JwtUser) {
    const userData = await this.usersService.findById(user.id);
    return { data: userData };
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  async updateMe(@CurrentUser() user: JwtUser, @Body() dto: UpdateUserDto) {
    const updated = await this.usersService.update(user.id, dto);
    return { data: updated };
  }

  @Delete('me')
  @ApiOperation({ summary: 'Soft delete current user (GDPR)' })
  async deleteMe(@CurrentUser() user: JwtUser) {
    await this.usersService.softDelete(user.id);
    return { data: { message: 'Account deleted successfully' } };
  }

  @Get('me/organizations')
  @ApiOperation({ summary: 'List organizations for current user' })
  async getMyOrganizations(@CurrentUser() user: JwtUser) {
    const orgs = await this.usersService.getUserOrganizations(user.id);
    return { data: orgs };
  }
}
