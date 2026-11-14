import nodemailer from "nodemailer";

let transporter;

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  if (process.env.SMTP_HOST) {
    const user = process.env.SMTP_USER;
    const password = process.env.SMTP_PASS;

    if (!user || !password) {
      throw new Error("SMTP_USER and SMTP_PASS are required when SMTP_HOST is set");
    }

    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: { user, pass: password },
    });
    return transporter;
  }

  const user = process.env.GOOGLE_USER_ID || process.env.GOOGLE_USER;
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } =
    process.env;

  if (user && GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REFRESH_TOKEN) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user,
        clientId: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        refreshToken: GOOGLE_REFRESH_TOKEN,
      },
    });
    return transporter;
  }

  throw new Error(
    "Mail is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS, or provide GOOGLE_USER_ID, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN.",
  );
}

export async function sendEmail({ to, subject, text, html }) {
  const from =
    process.env.MAIL_FROM ||
    process.env.SMTP_USER ||
    process.env.GOOGLE_USER_ID ||
    process.env.GOOGLE_USER;

  if (!from) {
    throw new Error("MAIL_FROM or a configured mail account is required");
  }

  const details = await getTransporter().sendMail({
    from,
    to,
    subject,
    text,
    html,
  });

  console.log("Email sent:", details.response);
  return details;
}
