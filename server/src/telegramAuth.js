// server/src/telegramAuth.js
// Verifies Telegram Mini App initData using the bot token.
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app

import { createHmac } from 'crypto';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

/**
 * Verifies the initData string sent by the Telegram client.
 * Returns { valid: boolean, data: object|null, error?: string }
 *
 * In development (no BOT_TOKEN set), skips verification and returns valid=true
 * so local testing without a real bot token still works.
 */
export function verifyInitData(initDataRaw) {
  // Dev mode: skip verification if no token configured
  if (!BOT_TOKEN) {
    if (process.env.NODE_ENV === 'production') {
      return { valid: false, data: null, error: 'TELEGRAM_BOT_TOKEN not configured' };
    }
    // Local dev — parse without verifying
    return { valid: true, data: parseInitData(initDataRaw) };
  }

  if (!initDataRaw) {
    // Not opened via Telegram (browser / dev testing) — allow unverified join.
    // Socket handler falls back to client-supplied telegramId/name.
    return { valid: true, data: {}, unverified: true };
  }

  try {
    const params = new URLSearchParams(initDataRaw);
    const receivedHash = params.get('hash');
    if (!receivedHash) return { valid: false, data: null, error: 'Missing hash in initData' };

    // Build the data-check string: all fields except hash, sorted, joined by \n
    const entries = [...params.entries()]
      .filter(([key]) => key !== 'hash')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => `${key}=${val}`)
      .join('\n');

    // Secret key = HMAC-SHA256("WebAppData", botToken)
    const secretKey = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();

    // Computed hash = HMAC-SHA256(secretKey, data-check-string)
    const computedHash = createHmac('sha256', secretKey).update(entries).digest('hex');

    if (computedHash !== receivedHash) {
      return { valid: false, data: null, error: 'initData hash mismatch' };
    }

    // Optional: reject data older than 1 hour
    const authDate = parseInt(params.get('auth_date') ?? '0', 10);
    const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
    if (ageSeconds > 3600) {
      return { valid: false, data: null, error: 'initData expired' };
    }

    return { valid: true, data: parseInitData(initDataRaw) };
  } catch (err) {
    return { valid: false, data: null, error: `Verification error: ${err.message}` };
  }
}

function parseInitData(raw) {
  if (!raw) return {};
  const params = new URLSearchParams(raw);
  const result = {};
  for (const [key, val] of params.entries()) {
    try { result[key] = JSON.parse(val); } catch { result[key] = val; }
  }
  return result;
}
