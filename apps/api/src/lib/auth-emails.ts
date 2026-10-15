
import { sendEmail } from './mailer.js';

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };

    return entities[char] ?? char;
  });
}

export async function sendPasswordResetEmail(
  email: string,
  name: string,
  resetUrl: string,
) {
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(resetUrl);

  await sendEmail({
    to: email,
    subject: 'Reset your Family Aquarium password',
    text: [
      `Hi ${name},`,
      '',
      'We received a request to reset your password.',
      `Reset your password: ${resetUrl}`,
      '',
      'This link expires in 1 hour.',
      'If you did not request this, you can ignore this email.',
      '',
      'Family Aquarium',
    ].join('\n'),
    html: `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Reset your password</title>
        </head>
        <body style="margin:0;padding:40px 16px;background:#eaf5fa;font-family:Arial,Helvetica,sans-serif;color:#123c57;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;margin:0 auto;">
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <div style="font-size:40px;">🐠</div>
                <div style="font-size:26px;font-weight:700;color:#07567b;">
                  Family Aquarium
                </div>
                <div style="font-size:13px;color:#5d8295;padding-top:6px;">
                  A little ocean full of imagination
                </div>
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;border-radius:20px;padding:36px 32px;">
                <h1 style="font-size:24px;margin:0 0 18px;color:#123c57;">
                  Reset your password
                </h1>
                <p style="font-size:16px;line-height:1.6;">
                  Hi ${safeName},
                </p>
                <p style="font-size:15px;line-height:1.7;color:#476779;">
                  We received a request to reset your Family Aquarium password.
                  Click the button below to create a new one.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;">
                  <tr>
                    <td style="background:#0786ba;border-radius:12px;">
                      <a href="${safeUrl}"
                         style="display:inline-block;padding:15px 28px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;">
                        Reset My Password →
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="font-size:13px;color:#6c8998;line-height:1.6;">
                  This link expires in 1 hour.
                </p>
                <p style="font-size:13px;color:#6c8998;line-height:1.6;">
                  If you didn't request this, you can safely ignore this email.
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:24px;font-size:12px;color:#7194a5;">
                Made for little artists and big imaginations.
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  });
}
