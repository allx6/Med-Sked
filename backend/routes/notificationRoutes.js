const express = require('express');

const Notification = require('../models/Notification');
const { safeReadNotificationMessage } = require('../models/Notification');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

const sanitizeNotification = (notification) => {
  const raw = notification?.toObject({ getters: false }) || {};
  return {
    ...raw,
    message: safeReadNotificationMessage(raw.message),
  };
};

router.get('/', authMiddleware, async (req, res) => {
  try {
    const notifications = await Notification.find({
      recipient: req.user.userId,
    }).sort({ createdAt: -1 });

    res.json(notifications.map(sanitizeNotification));
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: 'Failed to retrieve notifications' });
  }
});

router.get('/unread-count', authMiddleware, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user.userId,
      read: false,
    });

    res.json({ count });
  } catch (error) {
    console.error('Get unread notification count error:', error);
    res.status(500).json({ message: 'Failed to retrieve unread notification count' });
  }
});

router.put('/:notificationId/read', authMiddleware, async (req, res) => {
  try {
    if (!require('mongoose').Types.ObjectId.isValid(req.params.notificationId)) {
      return res.status(400).json({ message: 'Invalid notification ID' });
    }

    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.notificationId,
        recipient: req.user.userId,
      },
      { read: true },
      { returnDocument: 'after' }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json(notification);
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ message: 'Failed to mark notification as read' });
  }
});

router.put('/read-all', authMiddleware, async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { recipient: req.user.userId, read: false },
      { $set: { read: true } }
    );

    res.json({ modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ message: 'Failed to mark notifications as read' });
  }
});

module.exports = router;