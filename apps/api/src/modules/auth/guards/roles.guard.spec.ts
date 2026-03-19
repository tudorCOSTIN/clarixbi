/* eslint-disable @typescript-eslint/no-explicit-any */
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { TeamRole } from '../../teams/entities/team-member.entity';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;
  let teamMemberRepo: any;

  beforeEach(() => {
    reflector = new Reflector();
    teamMemberRepo = {
      findOne: jest.fn(),
    };
    guard = new RolesGuard(reflector, teamMemberRepo);
  });

  const createMockContext = (user: any, orgId: string): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          orgId,
          params: { orgId },
        }),
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as any;
  };

  it('should allow access when no roles are required', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createMockContext({ id: 'user-1' }, 'org-1');

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should allow access when user has sufficient role', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([TeamRole.ADMIN]);
    teamMemberRepo.findOne.mockResolvedValue({ role: TeamRole.OWNER });
    const context = createMockContext({ id: 'user-1' }, 'org-1');

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should deny access when user has insufficient role', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([TeamRole.ADMIN]);
    teamMemberRepo.findOne.mockResolvedValue({ role: TeamRole.VIEWER });
    const context = createMockContext({ id: 'user-1' }, 'org-1');

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should deny access when user is not a member', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([TeamRole.VIEWER]);
    teamMemberRepo.findOne.mockResolvedValue(null);
    const context = createMockContext({ id: 'user-1' }, 'org-1');

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should deny when missing user or org context', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([TeamRole.ADMIN]);
    const context = createMockContext(null, '');

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });
});
