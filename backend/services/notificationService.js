const Notification = require('../models/Notification');

const createNotification = async ({
  recipient,
  type,
  message,
  relatedEntityType,
  relatedEntityId,
  dedupeKey,
}) => {
  if (!recipient || !type || !message) {
    return null;
  }

  try {
    return await Notification.create({
      recipient,
      type,
      message,
      relatedEntityType,
      relatedEntityId,
      dedupeKey,
    });
  } catch (error) {
    if (error.code === 11000 && dedupeKey) {
      return null;
    }
    console.error('Create notification error:', error);
    return null;
  }
};

module.exports = {
  createNotification,
};