const Notification = require('../models/Notification');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const sendResponse = require('../utils/sendResponse');

const listNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(30);
  const unread = await Notification.countDocuments({ user: req.user._id, read: false });
  sendResponse(res, { data: { notifications, unread } });
});

const markRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({ _id: req.params.id, user: req.user._id });
  if (!notification) throw new AppError('Notification not found', 404);
  notification.read = true;
  await notification.save();
  sendResponse(res, { data: notification });
});

const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
  sendResponse(res, { message: 'All notifications marked as read' });
});

module.exports = { listNotifications, markRead, markAllRead };
