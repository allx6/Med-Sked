const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('../models/User');

const router = express.Router();

const generatePatientId = async () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let candidate;

  do {
    candidate = 'MSK-';

    for (let i = 0; i < 6; i += 1) {
      candidate += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (await User.exists({ patientId: candidate }));

  return candidate;
};


// =====================================================
// REGISTER
// POST /api/auth/register
// =====================================================

router.post('/register', async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
    } = req.body;


    // =====================================================
    // VALIDATION
    // =====================================================

    if (
      !name ||
      !email ||
      !password ||
      !role
    ) {
      return res.status(400).json({
        message:
          'Name, email, password, and account type are required.',
      });
    }


    // =====================================================
    // VALID ROLE
    // =====================================================

    if (
      role !== 'patient' &&
      role !== 'caregiver'
    ) {
      return res.status(400).json({
        message:
          'Invalid account type.',
      });
    }


    // =====================================================
    // PASSWORD VALIDATION
    // =====================================================

    if (password.length < 6) {
      return res.status(400).json({
        message:
          'Password must be at least 6 characters.',
      });
    }


    // =====================================================
    // NORMALIZE DATA
    // =====================================================

    const normalizedName =
      name.trim();

    const normalizedEmail =
      email.trim().toLowerCase();


    // =====================================================
    // CHECK EMPTY VALUES
    // =====================================================

    if (!normalizedName) {
      return res.status(400).json({
        message:
          'Name cannot be empty.',
      });
    }

    if (!normalizedEmail) {
      return res.status(400).json({
        message:
          'Email cannot be empty.',
      });
    }


    // =====================================================
    // CHECK DUPLICATE EMAIL
    // =====================================================

    const existingEmail =
      await User.findOne({
        email: normalizedEmail,
      });

    if (existingEmail) {
      return res.status(409).json({
        message:
          'An account with this email already exists.',
      });
    }


    // =====================================================
    // CREATE USERNAME FROM NAME
    // =====================================================

    let baseUsername =
      normalizedName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');


    // If the name contains only unsupported characters
    // such as symbols, prevent an empty username.

    if (!baseUsername) {
      return res.status(400).json({
        message:
          'Please enter a valid name.',
      });
    }


    // =====================================================
    // CHECK USERNAME
    // =====================================================

    let username =
      baseUsername;

    let counter = 1;

    while (
      await User.findOne({
        username,
      })
    ) {
      username =
        `${baseUsername}${counter}`;

      counter++;
    }


    // =====================================================
    // HASH PASSWORD
    // =====================================================

    const hashedPassword =
      await bcrypt.hash(
        password,
        10
      );


    // =====================================================
    // GENERATE UNIQUE PATIENT ID
    // =====================================================

    let patientId = null;

    if (role === 'patient') {
      patientId = await generatePatientId();
    }

    // =====================================================
    // CREATE USER
    // =====================================================

    const user =
      await User.create({
        username,

        email:
          normalizedEmail,

        patientId,

        password:
          hashedPassword,

        role,
      });


    // =====================================================
    // CREATE JWT
    // =====================================================

    const token =
      jwt.sign(
        {
          userId:
            user._id.toString(),

          username:
            user.username,

          role:
            user.role,
        },

        process.env.JWT_SECRET,

        {
          expiresIn: '7d',
        }
      );


    // =====================================================
    // RESPONSE
    // =====================================================

    return res.status(201).json({
      message:
        'Account created successfully.',

      token,

      user: {
        id:
          user._id,

        username:
          user.username,

        email:
          user.email,

        patientId:
          user.patientId,

        role:
          user.role,
      },
    });

  } catch (error) {

    console.error(
      'Register error:',
      error
    );

    return res.status(500).json({
      message:
        'Failed to create account.',
    });
  }
});


// =====================================================
// LOGIN
// POST /api/auth/login
// =====================================================

router.post('/login', async (req, res) => {
  try {

    const {
      email,
      password,
    } = req.body;


    // =====================================================
    // VALIDATION
    // =====================================================

    if (
      !email ||
      !password
    ) {
      return res.status(400).json({
        message:
          'Email and password are required.',
      });
    }


    // =====================================================
    // NORMALIZE EMAIL
    // =====================================================

    const normalizedEmail =
      email.trim().toLowerCase();


    // =====================================================
    // FIND USER
    // =====================================================

    const user =
      await User.findOne({
        email:
          normalizedEmail,
      });


    if (!user) {
      return res.status(401).json({
        message:
          'Invalid email or password.',
      });
    }


    // =====================================================
    // CHECK PASSWORD
    // =====================================================

    const passwordMatches =
      await bcrypt.compare(
        password,
        user.password
      );


    if (!passwordMatches) {
      return res.status(401).json({
        message:
          'Invalid email or password.',
      });
    }

    if (user.role === 'patient' && !user.patientId) {
      user.patientId = await generatePatientId();
      await user.save();
    }


    // =====================================================
    // CREATE JWT
    // =====================================================

    const token =
      jwt.sign(
        {
          userId:
            user._id.toString(),

          username:
            user.username,

          role:
            user.role,
        },

        process.env.JWT_SECRET,

        {
          expiresIn: '7d',
        }
      );


    // =====================================================
    // RESPONSE
    // =====================================================

    return res.json({
      message:
        'Login successful.',

      token,

      user: {
        id:
          user._id,

        username:
          user.username,

        email:
          user.email,

        patientId:
          user.patientId,

        role:
          user.role,
      },
    });

  } catch (error) {

    console.error(
      'Login error:',
      error
    );

    return res.status(500).json({
      message:
        'Failed to log in.',
    });
  }
});


// =====================================================
// EXPORT ROUTER
// =====================================================

module.exports = router;