import nodemailer, { Transporter } from 'nodemailer';
import { logger } from '../utils/logger';
import { config } from '../config/env';

class EmailService {
  private transporter: Transporter | null;
  private readonly fromAddress: string;

  constructor() {
    const { smtpHost, smtpPort, smtpUser, smtpPass, fromAddress } = config.email;

    this.fromAddress = fromAddress;

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
      this.transporter = null;
      logger.warn('SMTP configuration is missing, email notifications are disabled', {
        hasHost: !!smtpHost,
        hasPort: !!smtpPort,
        hasUser: !!smtpUser,
        hasPass: !!smtpPass
      });
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass
      },
      connectionTimeout: 60000,
      greetingTimeout: 30000,
      socketTimeout: 60000,
      pool: true,
      maxConnections: 5,
      maxMessages: 100
    });

    logger.info('Email service initialized', { host: smtpHost, port: smtpPort, user: smtpUser.substring(0, 3) + '***' });
  }

  isConfigured(): boolean {
    return this.transporter !== null && this.fromAddress !== undefined;
  }

  async sendWaitlistConfirmation(email: string, name?: string): Promise<boolean> {
    if (!this.transporter) {
      logger.warn('Email service not configured - SMTP settings missing', { email });
      return false;
    }

    if (!this.fromAddress) {
      logger.warn('Email from address not configured', { email });
      return false;
    }

    const subject = 'Welcome to Synkio';
    const displayName = name || 'there';
    const greeting = name ? `Welcome, ${displayName}! 👋` : 'Welcome! 👋';

    const text = `${greeting}

Thank you for joining the Synkio waitlist! We're excited to have you on board.

You're now part of an exclusive group that will be the first to experience our revolutionary conversational marketplace. We're building something special that will transform how you discover, chat, and transact with vendors.

What to Expect:
- Conversational marketplace experience
- Secure escrow for all transactions
- Multi-channel support (WhatsApp, Web)
- Transparent payment tracking
- Seamless Payments in Crypto or fiat

We'll notify you as soon as we launch. In the meantime, follow us for updates and sneak peeks!

© 2025 Synkio. All rights reserved.
You're receiving this because you signed up for our waitlist.`;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Synkio</title>
</head>
<body style="margin: 0; padding: 0; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #101322; color: #ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #101322; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1B1B1E; border-radius: 12px; overflow: hidden; border: 1px solid #DFF5FF20;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #101322 0%, #1B1B1E 100%);">
              <h1 style="margin: 0; font-size: 36px; font-weight: bold; color: #DFF5FF; letter-spacing: -0.5px;">
                Synkio
              </h1>
              <p style="margin: 8px 0 0; font-size: 16px; color: #10B981; font-weight: 600; text-transform: uppercase; letter-spacing: 2px;">
                Conversational Marketplace
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; font-size: 24px; font-weight: 600; color: #ffffff;">
                ${greeting}
              </h2>
              
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #DFF5FF;">
                Thank you for joining the Synkio waitlist! We're excited to have you on board.
              </p>
              
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #DFF5FF;">
                You're now part of an exclusive group that will be the first to experience our revolutionary conversational marketplace. We're building something special that will transform how you discover, chat, and transact with vendors.
              </p>
              
              <div style="background-color: #DFF5FF10; border-left: 3px solid #10B981; padding: 20px; margin: 30px 0; border-radius: 8px;">
                <h3 style="margin: 0 0 12px; font-size: 18px; font-weight: 600; color: #ffffff;">
                  What to Expect:
                </h3>
                <ul style="margin: 0; padding-left: 20px; color: #DFF5FF; line-height: 1.8;">
                  <li>Conversational marketplace experience</li>
                  <li>Secure escrow for all transactions</li>
                  <li>Multi-channel support (WhatsApp, Web)</li>
                  <li>Transparent payment tracking</li> 
                  <li>Seemless Payments in Crypto or fiat</li>     
                </ul>
              </div>
              
              <p style="margin: 20px 0 0; font-size: 14px; line-height: 1.6; color: #DFF5FF80;">
                We'll notify you as soon as we launch. In the meantime, follow us for updates and sneak peeks!
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; text-align: center; background-color: #101322; border-top: 1px solid #DFF5FF10;">
              <p style="margin: 0 0 10px; font-size: 14px; color: #DFF5FF60;">
                © 2025 Synkio. All rights reserved.
              </p>
              <p style="margin: 0; font-size: 12px; color: #DFF5FF40;">
                You're receiving this because you signed up for our waitlist.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    try {
      const info = await this.transporter.sendMail({
        from: this.fromAddress,
        to: email,
        subject,
        text,
        html
      });

      logger.info('Sent waitlist confirmation email successfully', { 
        email, 
        messageId: info.messageId,
        response: info.response 
      });
      return true;
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';
      const errorCode = error.code || 'UNKNOWN';
      
      if (errorCode === 'ETIMEDOUT' || errorMessage.includes('timeout') || errorMessage.includes('Connection timeout')) {
        logger.error('SMTP connection timeout - server may be slow or unreachable', {
          email,
          errorCode,
          error: errorMessage,
          hint: 'Check SMTP server connectivity and network settings',
          smtpHost: config.email.smtpHost
        });
      } else if (errorCode === 'EAUTH' || errorMessage.includes('Invalid login') || errorMessage.includes('WebLoginRequired')) {
        logger.error('Gmail authentication error - App Password required', {
          email,
          errorCode,
          error,
          hint: 'Enable 2FA and generate an App Password at https://myaccount.google.com/apppasswords'
        });
      } else {
        logger.error('Error sending waitlist confirmation email', { 
          email, 
          error: errorMessage,
          code: errorCode,
          stack: error.stack
        });
      }
      
      return false;
    }
  }
}

export const emailService = new EmailService();

