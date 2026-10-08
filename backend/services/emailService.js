const { Resend } = require('resend');

const sendEmail = async (email, subject, text) => {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('Email API is not configured.');
  }
  if (!process.env.RESEND_FROM_EMAIL) {
    throw new Error('Email sender is not configured.');
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to: email,
    subject,
    text,
  });

  if (error) {
    throw new Error('Email delivery failed.');
  }

  return data;
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
  sendVerificationEmail,
  sendPasswordResetEmail,
};
