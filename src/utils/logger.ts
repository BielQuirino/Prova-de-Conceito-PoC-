import { maskPhone } from './piiMasker';

function sanitize(data?: Record<string, unknown>) {
  if (!data) return data;
  const safe = { ...data };
  if (typeof safe.phone === 'string') safe.phone = maskPhone(safe.phone);
  return safe;
}

export const logger = {
  info: (msg: string, data?: Record<string, unknown>) =>
    console.log(`[INFO] ${msg}`, sanitize(data) ?? ''),
  error: (msg: string, err?: unknown) =>
    console.error(`[ERROR] ${msg}`, err),
};
