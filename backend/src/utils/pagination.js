const getPagination = (query) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 10, 1), 100);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const buildSearchFilter = (search, fields = []) => {
  if (!search || !fields.length) return {};
  const regex = { $regex: search.trim(), $options: 'i' };
  return { $or: fields.map((field) => ({ [field]: regex })) };
};

module.exports = { getPagination, buildSearchFilter };
