const AuditLog = require('../models/AuditLog');

const createAuditLog = async ({
  actorId,
  actorRole,
  action,
  targetType,
  targetId,
  details = {},
}) => {
  if (!actorId || !actorRole || !action || !targetType || !targetId) {
    return null;
  }

  try {
    return await AuditLog.create({
      actorId,
      actorRole,
      action,
      targetType,
      targetId,
      details,
    });
  } catch (error) {
    console.error('Create audit log error:', error.message);
    return null;
  }
};

module.exports = {
  createAuditLog,
};
