import nodemailer from 'nodemailer';

type EmailOptions = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

const emailProvider = process.env.EMAIL_PROVIDER ?? 'smtp';

async function sendWithResend(options: EmailOptions) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const from = process.env.RESEND_FROM;
  if (!from) {
    throw new Error('RESEND_FROM is not configured');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [options.to],
      subject: options.subject,
      text: options.text,
      ...(options.html ? { html: options.html } : {}),
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    // Never log the API key or email body. Resend's response helps diagnose
    // sender-domain restrictions, rate limits, and invalid recipients.
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Resend API request failed (${response.status}): ${detail}`);
  }

  return response.json();
}

async function sendWithSmtp(options: EmailOptions) {
  const host = process.env.SMTP_HOST;
  if (!host) {
    throw new Error('SMTP_HOST is not configured');
  }

  const port = Number(process.env.SMTP_PORT ?? 587);
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    ...(process.env.SMTP_USER && process.env.SMTP_PASSWORD
      ? {
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          },
        }
      : {}),
  });

  return transporter.sendMail({
    from: process.env.SMTP_FROM ?? 'Family Aquarium <hello@aquarium.local>',
    ...options,
  });
}

export async function sendEmail(options: EmailOptions) {
  if (emailProvider === 'resend') {
    return sendWithResend(options);
  }
  if (emailProvider === 'smtp') {
    return sendWithSmtp(options);
  }
  throw new Error(`Unsupported EMAIL_PROVIDER: ${emailProvider}`);
}
