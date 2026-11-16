/**
 * The branded verification email (emails/verify-email.html), filled in and sent
 * by SMTP (e.g. Mailtrap, or Gmail with an app password) or, failing that, through Resend.
 * Server code only: it reads the mail credentials.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";

const TEMPLATE_PATH = path.join(process.cwd(), "emails", "verify-email.html");
const SUBJECT = "Confirm your email for greenboard";

const smtpConfigured = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

/** True when a way to send (SMTP or Resend) and the sender address are set. */
export function isEmailConfigured() {
  return Boolean((smtpConfigured() || process.env.RESEND_API_KEY) && process.env.EMAIL_FROM);
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

let template: string | null = null;

async function loadTemplate() {
  if (template) return template;
  const raw = await readFile(TEMPLATE_PATH, "utf8");
  // Drop the HTML comments (setup notes and paste markers); they aren't for recipients.
  template = raw.replace(/<!--[\s\S]*?-->\n?/g, "");
  return template;
}

/** The email's HTML, with every value escaped (the name is whatever the user typed). */
async function renderHtml({ name, email, link }: { name: string; email: string; link: string }) {
  const html = await loadTemplate();
  return html
    .replaceAll("%DISPLAY_NAME%", escapeHtml(name))
    .replaceAll("%EMAIL%", escapeHtml(email))
    .replaceAll("%LINK%", escapeHtml(link));
}

/** A plain-text copy, for mail apps that don't show HTML (and for spam filters). */
function renderText({ name, email, link }: { name: string; email: string; link: string }) {
  return [
    `Hi ${name},`,
    "",
    `Thanks for joining greenboard. Open this link to confirm that ${email} is yours:`,
    "",
    link,
    "",
    "The link works once and expires after a while. If it has, log in and ask for a new one.",
    "",
    "Didn't create a greenboard account? You can ignore this email; nothing will happen.",
    "",
    "greenboard · Tick it off. Watch it get done.",
  ].join("\n");
}

export class EmailSendError extends Error {}

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;

/** SMTP connection, reused between sends. Port 465 uses TLS from the start; 587 and 2525 upgrade with STARTTLS. */
function smtp() {
  if (transport) return transport;
  const port = Number(process.env.SMTP_PORT || 465);
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    // Gmail app passwords are shown in groups of four; spaces aren't part of them.
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS?.replace(/\s+/g, "") },
  });
  return transport;
}

export async function sendVerificationEmail(to: { name: string; email: string }, link: string) {
  const values = { name: to.name || "there", email: to.email, link };

  if (smtpConfigured()) {
    try {
      await smtp().sendMail({
        from: process.env.EMAIL_FROM,
        to: to.email,
        replyTo: process.env.EMAIL_REPLY_TO || undefined,
        subject: SUBJECT,
        html: await renderHtml(values),
        text: renderText(values),
      });
    } catch (error) {
      // e.g. a wrong app password ("Invalid login"); keep the details for the server log only.
      throw new EmailSendError(`SMTP send failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [to.email],
      reply_to: process.env.EMAIL_REPLY_TO || undefined,
      subject: SUBJECT,
      html: await renderHtml(values),
      text: renderText(values),
    }),
  });
  if (!response.ok) {
    // Resend explains what's wrong (unverified domain, bad key…); keep it for the server log only.
    const detail = await response.text().catch(() => "");
    throw new EmailSendError(`Resend responded ${response.status}: ${detail.slice(0, 300)}`);
  }
}
