const mongoose = require('mongoose');
const User = require('../models/User');

const customerIdCounterSchema = new mongoose.Schema({
  prefix: { type: String, required: true, unique: true, uppercase: true },
  seq: { type: Number, default: 0 },
});

const CustomerIdCounter = mongoose.model('CustomerIdCounter', customerIdCounterSchema);

const MAX_PRIMARY_SEQ = 99999;
const FALLBACK_KEY_PREFIX = 'FB:';

const extractPrefix = (name) => {
  const letters = String(name || '')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase();
  if (!letters) return 'CUS';
  if (letters.length >= 3) return letters.slice(0, 3);
  return letters.padEnd(3, 'X');
};

const extractFirstLetter = (name) => {
  const letters = String(name || '')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase();
  return letters[0] || 'C';
};

const nextSeq = async (prefix) => {
  const doc = await CustomerIdCounter.findOneAndUpdate(
    { prefix: prefix.toUpperCase() },
    { $inc: { seq: 1 } },
    { returnDocument: 'after', upsert: true }
  );
  return doc.seq;
};

const formatPrimaryId = (prefix, seq) => `${prefix}${String(seq).padStart(5, '0')}`;

const formatFallbackId = (letter, seq) => `${letter}${String(seq).padStart(7, '0')}`;

const buildNextId = async (name) => {
  const prefix = extractPrefix(name);
  const letter = extractFirstLetter(name);
  const seq = await nextSeq(prefix);

  if (seq <= MAX_PRIMARY_SEQ) {
    return formatPrimaryId(prefix, seq);
  }

  const fallbackSeq = await nextSeq(`${FALLBACK_KEY_PREFIX}${letter}`);
  return formatFallbackId(letter, fallbackSeq);
};

const generateCustomerId = async (name, maxRetries = 3) => {
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    const customerId = await buildNextId(name);
    const exists = await User.exists({ customerId });
    if (!exists) return customerId;
  }
  throw new Error('Failed to generate unique customer ID');
};

/** Seed counters from existing customer IDs (run before backfill if IDs already exist). */
const seedCountersFromExisting = async () => {
  const customers = await User.find({ role: 'customer', customerId: { $exists: true, $ne: '' } }).select(
    'customerId'
  );

  const maxByPrefix = {};

  for (const { customerId } of customers) {
    const primary = /^([A-Z]{3})(\d{5})$/.exec(customerId);
    if (primary) {
      const [, prefix, seqStr] = primary;
      const seq = Number(seqStr);
      maxByPrefix[prefix] = Math.max(maxByPrefix[prefix] || 0, seq);
      continue;
    }

    const fallback = /^([A-Z])(\d{7})$/.exec(customerId);
    if (fallback) {
      const [, letter, seqStr] = fallback;
      const key = `${FALLBACK_KEY_PREFIX}${letter}`;
      const seq = Number(seqStr);
      maxByPrefix[key] = Math.max(maxByPrefix[key] || 0, seq);
    }
  }

  await Promise.all(
    Object.entries(maxByPrefix).map(([prefix, seq]) =>
      CustomerIdCounter.findOneAndUpdate(
        { prefix },
        { $max: { seq } },
        { upsert: true, returnDocument: 'after' }
      )
    )
  );
};

module.exports = {
  generateCustomerId,
  seedCountersFromExisting,
  extractPrefix,
  CustomerIdCounter,
};
