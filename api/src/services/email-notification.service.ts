/**
 * Email Notification Service - Send emails for password reset and alerts
 * Supports multiple SMTP providers
 */

import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

/**
 * Email notification configuration
 */
export interface EmailConfig {
  provider: 'smtp' | 'sendgrid' | 'mailgun';
  from: string; // Sender email address
  replyTo?: string; // Reply-to address
  // SMTP config
  host?: string;
  port?: number;
  secure?: boolean;
  username?: string;
  password?: string;
  // SendGrid config
  sendgridApiKey?: string;
  // Mailgun config
  mailgunApiKey?: string;
  mailgunDomain?: string;
}

/**
 * Email to send
 */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Email notification service
 */
export class EmailNotificationService {
  private config: EmailConfig;
  private transporter?: Transporter;

  constructor(config: EmailConfig) {
    this.config = config;
    this.initializeTransporter();
  }

  /**
   * Initialize email transporter based on provider
   */
  private initializeTransporter(): void {
    if (this.config.provider === 'smtp') {
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port || 587,
        secure: this.config.secure || false,
        auth: {
          user: this.config.username,
          pass: this.config.password,
        },
      });
    } else if (this.config.provider === 'sendgrid') {
      // SendGrid SMTP relay
      this.transporter = nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        auth: {
          user: 'apikey',
          pass: this.config.sendgridApiKey,
        },
      });
    } else if (this.config.provider === 'mailgun') {
      this.transporter = nodemailer.createTransport({
        host: `smtp.mailgun.org`,
        port: 587,
        secure: false,
        auth: {
          user: `postmaster@${this.config.mailgunDomain}`,
          pass: this.config.mailgunApiKey,
        },
      });
    }
  }

  /**
   * Send email
   */
  async sendEmail(message: EmailMessage): Promise<void> {
    if (!this.transporter) {
      throw new Error('Email transporter not configured');
    }

    try {
      await this.transporter.sendMail({
        from: this.config.from,
        replyTo: this.config.replyTo || this.config.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
    } catch (error) {
      throw new Error(`Failed to send email: ${String(error)}`);
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(
    to: string,
    username: string,
    resetUrl: string,
  ): Promise<void> {
    const html = `
      <h2>Password Reset Request</h2>
      <p>Hello ${this.escapeHtml(username)},</p>
      <p>We received a request to reset your MHN password. Click the link below to proceed:</p>
      <p><a href="${this.escapeHtml(resetUrl)}">Reset Password</a></p>
      <p>This link expires in 1 hour.</p>
      <p>If you did not request this, please ignore this email.</p>
      <hr />
      <p><small>Modern Honey Network (MHN)</small></p>
    `;

    const text = `Password Reset Request\n\nHello ${username},\n\nCopy this link to reset your password:\n${resetUrl}\n\nThis link expires in 1 hour.`;

    await this.sendEmail({
      to,
      subject: 'MHN Password Reset Request',
      html,
      text,
    });
  }

  /**
   * Send security alert email
   */
  async sendSecurityAlertEmail(
    to: string,
    alertType: 'ddos' | 'port_scan' | 'high_severity',
    details: {
      sensorName: string;
      sourceIp: string;
      description: string;
      count?: number;
    },
  ): Promise<void> {
    const alertTitle =
      alertType === 'ddos'
        ? 'DDoS Attack Detected'
        : alertType === 'port_scan'
          ? 'Port Scanning Detected'
          : 'High Severity Attack';

    const html = `
      <h2>Security Alert: ${alertTitle}</h2>
      <p>An alert has been triggered on your MHN instance:</p>
      <ul>
        <li><strong>Alert Type:</strong> ${alertTitle}</li>
        <li><strong>Sensor:</strong> ${this.escapeHtml(details.sensorName)}</li>
        <li><strong>Source IP:</strong> ${this.escapeHtml(details.sourceIp)}</li>
        ${details.count ? `<li><strong>Event Count:</strong> ${details.count}</li>` : ''}
        <li><strong>Description:</strong> ${this.escapeHtml(details.description)}</li>
      </ul>
      <p>Please review the attack details in your MHN dashboard.</p>
      <hr />
      <p><small>Modern Honey Network (MHN)</small></p>
    `;

    const text = `Security Alert: ${alertTitle}\n\nSensor: ${details.sensorName}\nSource IP: ${details.sourceIp}\nDescription: ${details.description}`;

    await this.sendEmail({
      to,
      subject: `MHN Alert: ${alertTitle}`,
      html,
      text,
    });
  }

  /**
   * Send password change confirmation email
   */
  async sendPasswordChangeConfirmationEmail(to: string): Promise<void> {
    const html = `
      <h2>Password Changed</h2>
      <p>Your password has been successfully changed on your MHN account.</p>
      <p>If you did not initiate this change, please contact your administrator immediately.</p>
      <hr />
      <p><small>Modern Honey Network (MHN)</small></p>
    `;

    const text =
      'Your password has been successfully changed on your MHN account.\n\nIf you did not make this change, please contact your administrator.';

    await this.sendEmail({
      to,
      subject: 'MHN Password Changed',
      html,
      text,
    });
  }

  /**
   * Send bulk email (e.g., daily report)
   */
  async sendBulkEmail(to: string[], subject: string, html: string, text?: string): Promise<void> {
    if (!this.transporter) {
      throw new Error('Email transporter not configured');
    }

    try {
      await this.transporter.sendMail({
        from: this.config.from,
        replyTo: this.config.replyTo || this.config.from,
        to: to.join(','),
        subject,
        html,
        text,
      });
    } catch (error) {
      throw new Error(`Failed to send bulk email: ${String(error)}`);
    }
  }

  /**
   * Test email configuration
   */
  async testConnection(): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
}
