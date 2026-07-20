import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

/**
 * Sends transactional email via AWS SES. If SES isn't configured (no from
 * address / credentials), falls back to logging the code — so the whole
 * verification flow works in development before SES is set up.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly ses: SESClient | null;
  private readonly from?: string;

  constructor(config: ConfigService) {
    this.from = config.get<string>("SES_FROM_EMAIL");
    const region = config.get<string>("AWS_REGION");
    const accessKeyId = config.get<string>("AWS_ACCESS_KEY_ID");
    const secretAccessKey = config.get<string>("AWS_SECRET_ACCESS_KEY");

    if (this.from && region && accessKeyId && secretAccessKey) {
      this.ses = new SESClient({ region, credentials: { accessKeyId, secretAccessKey } });
    } else {
      this.ses = null;
      this.logger.warn(
        "SES not configured — verification codes will be logged to the console (dev mode).",
      );
    }
  }

  async sendVerificationCode(to: string, code: string): Promise<void> {
    if (!this.ses || !this.from) {
      this.logger.log(`[DEV] Email verification code for ${to}: ${code}`);
      return;
    }
    const html = `
      <div style="font-family:sans-serif;max-width:420px">
        <h2>Verify your email</h2>
        <p>Your Salary Calculator verification code is:</p>
        <p style="font-size:28px;font-weight:800;letter-spacing:6px">${code}</p>
        <p style="color:#666">It expires in 10 minutes. If you didn't request this, ignore this email.</p>
      </div>`;
    await this.ses.send(
      new SendEmailCommand({
        Source: this.from,
        Destination: { ToAddresses: [to] },
        Message: {
          Subject: { Data: "Your Salary Calculator verification code" },
          Body: {
            Text: { Data: `Your verification code is ${code}. It expires in 10 minutes.` },
            Html: { Data: html },
          },
        },
      }),
    );
  }
}
