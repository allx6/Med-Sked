const nodemailer = require('nodemailer');

const createEmailTransporter = () => {
  const { EMAIL_USER, EMAIL_APP_PASSWORD } = process.env;

  if (!EMAIL_USER || !EMAIL_APP_PASSWORD) {
    throw new Error('Email configuration is incomplete.');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_APP_PASSWORD,
    },
  });
};

const sendEmail = async (email, subject, text) => {
  if (!process.env.EMAIL_FROM) {
    throw new Error('Email sender is not configured.');
  }

  const transporter = createEmailTransporter();

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject,
      text,
    });
  } finally {
    transporter.close();
  }
};

const sendVerificationEmail = (email, otp) => sendEmail(
  email,
  'Verify your MedSked email',
  `Your MedSked verification code is ${otp}. It expires in 10 minutes.`
);

const sendPasswordResetEmail = (email, otp) => sendEmail(
  email,
  'MedSked Password Reset Code',
  `A password reset was requested for your MedSked account.\n\n`
    + `Your 6-digit password reset code is ${otp}. It expires in 10 minutes.\n\n`
    + 'Do not share this code with anyone. If you did not request a password reset, you can ignore this email.'
);

module.exports = {
  createEmailTransporter,
  sendVerificationEmail,
  sendPasswordResetEmail,
};
