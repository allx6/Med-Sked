const nodemailer = require('nodemailer');
const parseAddresses = require('nodemailer/lib/addressparser');

const isValidMailbox = (address) => (
  typeof address === 'string'
  && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address)
);

const validateEmailAddress = (value, field, { allowDisplayName = false } = {}) => {
  const input = typeof value === 'string' ? value.trim() : '';
  const parsed = parseAddresses(input);
  if (
    parsed.length !== 1
    || !isValidMailbox(parsed[0].address)
    || (!allowDisplayName && parsed[0].name)
  ) {
    const error = new Error(`Email ${field} address is invalid.`);
    error.code = 'EMAIL_ADDRESS_INVALID';
    error.emailField = field;
    throw error;
  }

  return parsed[0];
};

const createEmailTransporter = () => {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASSWORD,
  } = process.env;

  const port = Number(SMTP_PORT);
  if (
    !SMTP_HOST
    || !SMTP_PORT
    || !Number.isInteger(port)
    || port < 1
    || port > 65535
    || !SMTP_USER
    || !SMTP_PASSWORD
  ) {
    throw new Error('Email configuration is incomplete.');
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASSWORD,
    },
  });
};

const sendEmail = async (email, subject, text) => {
  if (!process.env.EMAIL_FROM) {
    throw new Error('Email sender is not configured.');
  }

  const recipient = validateEmailAddress(email, 'recipient').address;
  validateEmailAddress(process.env.EMAIL_FROM, 'sender', { allowDisplayName: true });
  const transporter = createEmailTransporter();

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM.trim(),
      to: recipient,
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

const sendAdminLoginCode = (email, otp) => sendEmail(
  email,
  'Your MedSked administrator sign-in code',
  `Your MedSked administrator sign-in code is ${otp}. It expires in 10 minutes. `
    + 'If you did not try to sign in, change your password and contact your administrator.'
);

module.exports = {
  createEmailTransporter,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendAdminLoginCode,
};
