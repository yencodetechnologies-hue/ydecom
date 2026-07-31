const MarginSetting = require('../models/MarginSetting');
const { MARGIN_ROLES } = require('../models/MarginSetting');
const asyncHandler = require('../utils/asyncHandler');
const sendResponse = require('../utils/sendResponse');

const getMargins = asyncHandler(async (req, res) => {
  let margins = await MarginSetting.find().sort({ role: 1 });
  if (margins.length < MARGIN_ROLES.length) {
    for (const role of MARGIN_ROLES) {
      await MarginSetting.findOneAndUpdate(
        { role },
        { $setOnInsert: { type: 'percentage', value: 0 } },
        { upsert: true }
      );
    }
    margins = await MarginSetting.find().sort({ role: 1 });
  }
  sendResponse(res, { data: margins });
});

const updateMargins = asyncHandler(async (req, res) => {
  const { margins } = req.body;
  const updated = [];
  for (const item of margins) {
    const doc = await MarginSetting.findOneAndUpdate(
      { role: item.role },
      { type: item.type, basis: item.basis || 'cost', value: item.value },
      { new: true, upsert: true, runValidators: true }
    );
    updated.push(doc);
  }
  sendResponse(res, { message: 'Margins updated', data: updated });
});

module.exports = { getMargins, updateMargins };
