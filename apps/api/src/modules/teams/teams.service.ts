import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { TeamMember, TeamRole, InviteStatus } from './entities/team-member.entity';
import { EmailService } from '../email/email.service';

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(TeamMember)
    private teamMemberRepo: Repository<TeamMember>,
    private emailService: EmailService,
  ) {}

  /**
   * Invite a new member to the organization by email.
   * Creates a pending team member record with an invite token.
   */
  async invite(
    orgId: string,
    inviterUserId: string,
    email: string,
    role: TeamRole,
  ): Promise<TeamMember> {
    // Check if already a member (by invite email or linked user email)
    const existing = await this.teamMemberRepo.findOne({
      where: [
        { org_id: orgId, invite_email: email, invite_status: InviteStatus.PENDING },
        { org_id: orgId, invite_email: email, invite_status: InviteStatus.ACCEPTED },
      ],
    });

    if (existing) {
      throw new ConflictException(
        'This email is already associated with a team member or pending invite',
      );
    }

    const inviteToken = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const member = this.teamMemberRepo.create({
      org_id: orgId,
      user_id: inviterUserId, // placeholder; will be replaced on accept
      role,
      invited_by: inviterUserId,
      invite_email: email,
      invite_token: inviteToken,
      invite_status: InviteStatus.PENDING,
      invite_expires_at: expiresAt,
    });

    const saved = await this.teamMemberRepo.save(member);

    // Send invite email
    const appUrl = process.env['NEXT_PUBLIC_APP_URL'] || 'http://localhost:3000';
    const inviteUrl = `${appUrl}/invites/${inviteToken}/accept`;
    await this.emailService.sendTeamInvite(email, orgId, 'Team Admin', inviteUrl);

    return saved;
  }

  /**
   * Accept a pending invite. Links the user and sets status to ACCEPTED.
   */
  async acceptInvite(inviteId: string, userId: string): Promise<TeamMember> {
    const invite = await this.teamMemberRepo.findOne({
      where: { id: inviteId, invite_status: InviteStatus.PENDING },
    });

    if (!invite) {
      throw new NotFoundException('Invite not found or already accepted');
    }

    // Check if invite has expired (older than 7 days)
    if (invite.invite_expires_at && invite.invite_expires_at < new Date()) {
      invite.invite_status = InviteStatus.EXPIRED;
      await this.teamMemberRepo.save(invite);
      throw new BadRequestException('Invite has expired');
    }

    invite.user_id = userId;
    invite.invite_status = InviteStatus.ACCEPTED;
    invite.joined_at = new Date();

    return this.teamMemberRepo.save(invite);
  }

  /**
   * Change the role of an existing team member.
   * Prevents removing the last OWNER.
   */
  async changeRole(orgId: string, memberId: string, newRole: TeamRole): Promise<TeamMember> {
    const member = await this.teamMemberRepo.findOne({
      where: { id: memberId, org_id: orgId },
    });

    if (!member) {
      throw new NotFoundException('Team member not found');
    }

    // If demoting an owner, ensure they are not the last one
    if (member.role === TeamRole.OWNER && newRole !== TeamRole.OWNER) {
      await this.assertNotLastOwner(orgId);
    }

    member.role = newRole;
    return this.teamMemberRepo.save(member);
  }

  /**
   * Soft-remove a team member from the organization.
   * Prevents removing the last OWNER.
   */
  async removeMember(orgId: string, memberId: string): Promise<void> {
    const member = await this.teamMemberRepo.findOne({
      where: { id: memberId, org_id: orgId },
    });

    if (!member) {
      throw new NotFoundException('Team member not found');
    }

    if (member.role === TeamRole.OWNER) {
      await this.assertNotLastOwner(orgId);
    }

    await this.teamMemberRepo.softRemove(member);
  }

  /**
   * List all active and pending members for an organization.
   */
  async listMembers(orgId: string): Promise<TeamMember[]> {
    return this.teamMemberRepo.find({
      where: {
        org_id: orgId,
        invite_status: In([InviteStatus.ACCEPTED, InviteStatus.PENDING]),
      },
      relations: ['user'],
      order: { created_at: 'ASC' },
    });
  }

  /**
   * List only pending invites for an organization.
   */
  async getPendingInvites(orgId: string): Promise<TeamMember[]> {
    return this.teamMemberRepo.find({
      where: {
        org_id: orgId,
        invite_status: InviteStatus.PENDING,
      },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Accept invite by token (public endpoint — user provides token from email link).
   */
  async acceptInviteByToken(token: string, userId: string): Promise<TeamMember> {
    const invite = await this.teamMemberRepo.findOne({
      where: { invite_token: token, invite_status: InviteStatus.PENDING },
    });

    if (!invite) {
      throw new NotFoundException('Invite not found or already accepted');
    }

    if (invite.invite_expires_at && invite.invite_expires_at < new Date()) {
      invite.invite_status = InviteStatus.EXPIRED;
      await this.teamMemberRepo.save(invite);
      throw new BadRequestException('Invite has expired');
    }

    invite.user_id = userId;
    invite.invite_status = InviteStatus.ACCEPTED;
    invite.joined_at = new Date();

    return this.teamMemberRepo.save(invite);
  }

  /**
   * Resend an existing pending invite (regenerate token + extend expiry).
   */
  async resendInvite(orgId: string, inviteId: string): Promise<TeamMember> {
    const invite = await this.teamMemberRepo.findOne({
      where: { id: inviteId, org_id: orgId, invite_status: InviteStatus.PENDING },
    });

    if (!invite) {
      throw new NotFoundException('Pending invite not found');
    }

    invite.invite_token = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    invite.invite_expires_at = expiresAt;

    return this.teamMemberRepo.save(invite);
  }

  /**
   * Revoke (delete) a pending invite.
   */
  async revokeInvite(orgId: string, inviteId: string): Promise<void> {
    const invite = await this.teamMemberRepo.findOne({
      where: { id: inviteId, org_id: orgId, invite_status: InviteStatus.PENDING },
    });

    if (!invite) {
      throw new NotFoundException('Pending invite not found');
    }

    await this.teamMemberRepo.remove(invite);
  }

  /**
   * Get count of active (accepted) members for an organization.
   */
  async getMemberCount(orgId: string): Promise<number> {
    return this.teamMemberRepo.count({
      where: {
        org_id: orgId,
        invite_status: InviteStatus.ACCEPTED,
      },
    });
  }

  /**
   * Throws BadRequestException if the given org has only one OWNER.
   */
  private async assertNotLastOwner(orgId: string): Promise<void> {
    const ownerCount = await this.teamMemberRepo.count({
      where: {
        org_id: orgId,
        role: TeamRole.OWNER,
        invite_status: InviteStatus.ACCEPTED,
      },
    });

    if (ownerCount <= 1) {
      throw new BadRequestException('Cannot remove or demote the last owner of the organization');
    }
  }
}
