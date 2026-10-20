import process from 'node:process';

export function loadConfig(env = process.env) {
  const usersRaw = env.SONAR_USERS_JSON;
  if (!usersRaw) throw new Error('SONAR_USERS_JSON is required');
  let users;
  try { users = JSON.parse(usersRaw); } catch { throw new Error('SONAR_USERS_JSON must be valid JSON'); }
  if (!Array.isArray(users) || users.length === 0) throw new Error('SONAR_USERS_JSON must be a non-empty array');
  for (const user of users) {
    if (!user || typeof user.id !== 'string' || (!user.tokenHash && !user.token) || typeof user.sonarToken !== 'string') {
      throw new Error('Each user requires id, tokenHash (or token), and sonarToken');
    }
  }
  const number = (key, fallback, min, max) => {
    const value = Number(env[key] ?? fallback);
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${key} must be an integer from ${min} to ${max}`);
    return value;
  };
  return {
    host: env.HOST || '127.0.0.1', port: number('PORT', 3000, 1, 65535), sonarUrl: (env.SONAR_URL || '').replace(/\/$/, ''),
    users, maxBodyBytes: number('MAX_BODY_BYTES', 1024 * 1024, 1024, 10 * 1024 * 1024),
    sonarTimeoutMs: number('SONAR_TIMEOUT_MS', 10000, 100, 120000), maxPageSize: number('MAX_PAGE_SIZE', 100, 1, 1000)
  };
}
