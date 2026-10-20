import crypto from 'node:crypto';

const digest = token => crypto.createHash('sha256').update(token).digest('hex');
const safeEqual = (a, b) => { const aa = Buffer.from(a); const bb = Buffer.from(b); return aa.length === bb.length && crypto.timingSafeEqual(aa, bb); };

export class StaticCredentialProvider {
  constructor(users) { this.users = users; }
  authenticate(token) {
    if (!token) return null;
    const hash = digest(token);
    return this.users.find(user => (user.tokenHash && safeEqual(String(user.tokenHash).toLowerCase(), hash)) || (user.token && safeEqual(user.token, token))) || null;
  }
  getSonarToken(user) { return user?.sonarToken || null; }
}

export function bearerToken(headers) {
  const value = headers.authorization || headers.Authorization;
  const match = typeof value === 'string' && value.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] || null;
}
