
import nodemailer from 'nodemailer';

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT ?? 587);

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465,
  ...(process.env.SMTP_USER && process.env.SMTP_PASSWORD
    ? {
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    }
    : {}),
});

export async function sendEmail(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  if (!smtpHost) {
    throw new Error('SMTP_HOST is not configured');
  }

  return transporter.sendMail({
    from: process.env.SMTP_FROM ?? 'Family Aquarium <hello@aquarium.local>',
    ...options,
  });
}
