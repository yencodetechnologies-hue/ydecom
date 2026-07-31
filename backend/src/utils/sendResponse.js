const sendResponse = (res, { statusCode = 200, success = true, message = '', data = null, meta = null }) => {
  const payload = { success, message };
  if (data !== null) payload.data = data;
  if (meta !== null) payload.meta = meta;
  return res.status(statusCode).json(payload);
};

module.exports = sendResponse;
