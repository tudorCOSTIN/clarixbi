import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;
  private readonly appUrl: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (apiKey) {
      this.resend = new Resend(apiKey);
    }
    this.appUrl = this.configService.get<string>('NEXT_PUBLIC_APP_URL') || 'http://localhost:3000';
  }

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    if (!this.resend) {
      this.logger.warn('RESEND_API_KEY not set, skipping email');
      return;
    }

    try {
      await this.resend.emails.send({
        from: 'ClarixBI <noreply@clarixbi.com>',
        to,
        subject,
        html,
      });
      this.logger.log(`Email sent to ${to}: ${subject}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${error}`);
    }
  }

  async sendTeamInvite(
    email: string,
    orgName: string,
    inviterName: string,
    inviteUrl: string,
  ): Promise<void> {
    await this.sendEmail(
      email,
      `Ai fost invitat in ${orgName} pe ClarixBI`,
      `<h2>Invitatie ClarixBI</h2>
       <p>${inviterName} te-a invitat sa te alaturi organizatiei <strong>${orgName}</strong> pe ClarixBI.</p>
       <p><a href="${inviteUrl}" style="background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block">Accepta invitatia</a></p>
       <p>Acest link expira in 7 zile.</p>`,
    );
  }

  async sendTrialReminder(email: string, daysLeft: number): Promise<void> {
    await this.sendEmail(
      email,
      daysLeft === 1
        ? 'Ultima zi din perioada de proba ClarixBI!'
        : `Mai ai ${daysLeft} zile din perioada de proba ClarixBI`,
      `<h2>Perioada ta de proba expira ${daysLeft === 1 ? 'azi' : `in ${daysLeft} zile`}</h2>
       <p>Upgradeaza acum pentru a pastra acces la toate functiile Pro.</p>
       <p><a href="${this.appUrl}/settings/billing" style="background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block">Vezi planuri</a></p>`,
    );
  }

  async sendTrialExpired(email: string): Promise<void> {
    await this.sendEmail(
      email,
      'Perioada de proba ClarixBI a expirat',
      `<h2>Perioada de proba a expirat</h2>
       <p>Contul tau a fost trecut pe planul Starter. Upgradeaza pentru a redobandi acces la functiile Pro.</p>
       <p><a href="${this.appUrl}/settings/billing" style="background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block">Upgradeaza acum</a></p>`,
    );
  }

  async sendAlertTriggered(
    email: string,
    alertName: string,
    value: number,
    threshold: number,
  ): Promise<void> {
    await this.sendEmail(
      email,
      `Alert ClarixBI: ${alertName}`,
      `<h2>Alert declansat: ${alertName}</h2>
       <p>Valoare curenta: <strong>${value}</strong> (prag: ${threshold})</p>
       <p><a href="${this.appUrl}/alerts" style="background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block">Vezi alerte</a></p>`,
    );
  }
}
