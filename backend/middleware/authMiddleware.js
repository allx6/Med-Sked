const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Check if Authorization header exists
    if (!authHeader) {
      return res.status(401).json({
        message: 'Authentication required',
      });
    }

    // Expected format:
    // Authorization: Bearer TOKEN

    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        message: 'Invalid authorization format',
      });
    }

    const token = parts[1];

    // Verify JWT
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );
    if (decoded.purpose && decoded.purpose !== 'access') {
      return res.status(401).json({
        message: 'Invalid or expired authentication token',
      });
    }

    const user = await User.findById(decoded.userId)
      .select('_id accountStatus authTokenVersion')
      .lean();
    if (!user) {
      return res.status(401).json({
        code: 'USER_NOT_FOUND',
        message: 'The account for this session could not be found.',
      });
    }
    if (user.accountStatus === 'deactivated') {
      return res.status(401).json({
        code: 'ACCOUNT_DEACTIVATED',
        message: 'Your account is deactivated. Contact an administrator for assistance.',
      });
    }
    if (Number(user.authTokenVersion || 0) !== Number(decoded.sessionVersion || 0)) {
      return res.status(401).json({
        code: 'SESSION_VERSION_MISMATCH',
        message: 'Your session is no longer valid. Please sign in again.',
      });
    }

    // Store authenticated user information
    // so routes can access req.user
    req.user = decoded;

    next();
  } catch (error) {
    console.error('Authentication error:', error.message);

    return res.status(401).json({
      message: 'Invalid or expired authentication token',
    });
  }
};

module.exports = authMiddleware;