
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


export async function sendVerificationEmail(
  email: string,
  name: string,
  verificationUrl: string,
) {
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(verificationUrl);

  await sendEmail({
    to: email,
    subject: 'Verify your Family Aquarium email',
    text: [
      `Hi ${name},`,
      '',
      'Family Aquarium email verification',
      'Please verify your email address.',
      '',
      `Verify your email: ${verificationUrl}`,
      '',
      'If you did not request this verification, you can ignore this email.',
      '',
      'Family Aquarium',
    ].join('\n'),
    html: `
      <!DOCTYPE html>
      <html lang="en">
        <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
        <body style="margin:0;padding:40px 16px;background:#eaf5fa;font-family:Arial,Helvetica,sans-serif;color:#123c57;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;margin:0 auto;">
            <tr><td align="center" style="padding-bottom:24px;">
              <div style="font-size:40px;">🐠</div>
              <div style="font-size:26px;font-weight:700;color:#07567b;">Family Aquarium</div>
              <div style="font-size:13px;color:#5d8295;padding-top:6px;">A little ocean full of imagination</div>
            </td></tr>
            <tr><td style="background:#ffffff;border-radius:20px;padding:36px 32px;">
              <h1 style="font-size:24px;margin:0 0 18px;color:#123c57;">Verify your email 🐠</h1>
              <p style="font-size:16px;line-height:1.6;">Hi ${safeName},</p>
              <p style="font-size:15px;line-height:1.7;color:#476779;">Please verify this email address to complete your account setup or email change.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;">
                <tr><td style="background:#0786ba;border-radius:12px;">
                  <a href="${safeUrl}" style="display:inline-block;padding:15px 28px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;">Verify My Email →</a>
                </td></tr>
              </table>
              <p style="font-size:13px;color:#6c8998;line-height:1.6;">If you didn't request this verification, you can safely ignore this email.</p>
            </td></tr>
            <tr><td align="center" style="padding:24px;font-size:12px;color:#7194a5;">Made for little artists and big imaginations.</td></tr>
          </table>
        </body>
      </html>
    `,
  });
}


export async function sendEmailChangeConfirmation(
  currentEmail: string,
  name: string,
  newEmail: string,
  confirmationUrl: string,
) {
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(newEmail);
  const safeUrl = escapeHtml(confirmationUrl);
  await sendEmail({
    to: currentEmail,
    subject: 'Confirm your Family Aquarium email change',
    text: [
      `Hi ${name},`,
      '',
      `We received a request to change your Family Aquarium email to ${newEmail}.`,
      'Approve this change using the link below:',
      confirmationUrl,
      '',
      'After approval, check your new email address for a verification link.',
      'If you did not request this, do not approve the change.',
      '',
      'Family Aquarium',
    ].join('\n'),
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
      <body style="margin:0;padding:40px 16px;background:#eaf5fa;font-family:Arial,Helvetica,sans-serif;color:#123c57">
        <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;border-spacing:0">
          <tr><td align="center" style="padding:0 0 24px"><div style="font-size:40px">🐠</div><div style="font-size:26px;font-weight:700;color:#07567b">Family Aquarium</div></td></tr>
          <tr><td style="background:#fff;border-radius:20px;padding:36px 32px"><h1 style="font-size:24px;margin:0 0 18px">Confirm your email change</h1>
            <p style="line-height:1.6">Hi ${safeName},</p><p style="line-height:1.7;color:#476779">Someone requested to change your account email to <strong>${safeEmail}</strong>.</p>
            <p style="line-height:1.7;color:#476779">Approve this request to continue. You'll then receive a verification link at the new address.</p>
            <p style="margin:28px 0"><a href="${safeUrl}" style="display:inline-block;background:#0786ba;color:#fff;border-radius:12px;padding:15px 28px;text-decoration:none;font-weight:700">Approve Email Change →</a></p>
            <p style="font-size:13px;color:#6c8998;line-height:1.6">Didn't request this? Ignore this email and keep your current address.</p>
          </td></tr><tr><td align="center" style="padding:24px;font-size:12px;color:#7194a5">Made for little artists and big imaginations.</td></tr>
        </table>
      </body></html>`,
  });
}


/** Sent only after a new account's first successful email verification. */
export async function sendWelcomeEmail(email: string, name: string) {
  const safeName = escapeHtml(name);
  const webUrl = (process.env.WEB_APP_URL ?? process.env.WEB_URL ?? 'http://localhost:5173').replace(/\/$/, '');
  const aquariumUrl = `${webUrl}/aquariums`;
  const safeAquariumUrl = escapeHtml(aquariumUrl);

  await sendEmail({
    to: email,
    subject: 'Welcome to Family Aquarium! 🐠',
    text: [
      `Hi ${name},`,
      '',
      'Your email is verified. Welcome to Family Aquarium!',
      '',
      'Here is how to get started:',
      '1. Create your first aquarium.',
      '2. Draw a fish or scan a drawing from paper.',
      '3. Add your fish to the aquarium and watch it swim.',
      '4. Connect a TV to enjoy your aquarium on the big screen.',
      '',
      `Open My Aquarium: ${aquariumUrl}`,
      '',
      'Have fun creating your own little underwater world!',
      'Family Aquarium',
    ].join('\n'),
    html: `
      <!DOCTYPE html>
      <html lang="en">
        <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Welcome to Family Aquarium</title></head>
        <body style="margin:0;padding:40px 16px;background:#eaf5fa;font-family:Arial,Helvetica,sans-serif;color:#123c57;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;margin:0 auto;">
            <tr><td align="center" style="padding-bottom:24px;">
              <div style="font-size:40px;">🐠</div>
              <div style="font-size:26px;font-weight:700;color:#07567b;">Family Aquarium</div>
              <div style="font-size:13px;color:#5d8295;padding-top:6px;">A little ocean full of imagination</div>
            </td></tr>
            <tr><td style="background:#ffffff;border-radius:20px;padding:36px 32px;">
              <h1 style="font-size:24px;margin:0 0 18px;color:#123c57;">Welcome to your ocean! 🐠</h1>
              <p style="font-size:16px;line-height:1.6;">Hi ${safeName},</p>
              <p style="font-size:15px;line-height:1.7;color:#476779;">Your email is verified and you're ready to bring your underwater world to life.</p>
              <p style="font-size:16px;font-weight:700;margin:24px 0 12px;">Get started in four easy steps</p>
              <ol style="font-size:15px;line-height:1.9;color:#476779;padding-left:22px;">
                <li>Create your first aquarium.</li>
                <li>Draw a fish or scan one from paper.</li>
                <li>Add your fish and watch it swim.</li>
                <li>Connect a TV for a bigger underwater adventure.</li>
              </ol>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;">
                <tr><td style="background:#0786ba;border-radius:12px;">
                  <a href="${safeAquariumUrl}" style="display:inline-block;padding:15px 28px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;">Open My Aquarium →</a>
                </td></tr>
              </table>
              <p style="font-size:13px;line-height:1.6;color:#6c8998;">Made for little artists and big imaginations. Have fun creating together!</p>
            </td></tr>
            <tr><td align="center" style="padding:24px;font-size:12px;color:#7194a5;">Family Aquarium</td></tr>
          </table>
        </body>
      </html>
    `,
  });
}
