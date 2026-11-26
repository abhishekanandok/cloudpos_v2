import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendVerificationEmail = async (email, name, token, shopId) => {
  const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}&shopId=${shopId}`;

  await transporter.sendMail({
    from: `"CloudPOS" <${process.env.FROM_EMAIL}>`,
    to: email,
    subject: 'Verify your CloudPOS account',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a56db;">Welcome to CloudPOS, ${name}!</h2>
        <p>Please verify your email address to activate your account.</p>
        <a href="${verifyUrl}" 
           style="display: inline-block; background: #1a56db; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 16px 0;">
          Verify Email
        </a>
        <p style="color: #666;">This link expires in 24 hours.</p>
        <p style="color: #666; font-size: 12px;">If you didn't create this account, ignore this email.</p>
      </div>
    `,
  });
};

export const sendPasswordReset = async (email, name, resetUrl) => {
  await transporter.sendMail({
    from: `"CloudPOS" <${process.env.FROM_EMAIL}>`,
    to: email,
    subject: 'Reset your CloudPOS password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a56db;">Password Reset</h2>
        <p>Hi ${name}, click below to reset your password.</p>
        <a href="${resetUrl}" style="display: inline-block; background: #1a56db; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
          Reset Password
        </a>
        <p style="color: #666;">This link expires in 1 hour.</p>
      </div>
    `,
  });
};
