export class SonarClient {
  constructor({ baseUrl, token, timeoutMs, fetchImpl = fetch }) { this.baseUrl = baseUrl; this.token = token; this.timeoutMs = timeoutMs; this.fetchImpl = fetchImpl; }
  async request(path, params = {}) {
    if (!this.baseUrl) throw new Error('SONAR_URL is not configured');
    const url = new URL(`/api/${path}`, this.baseUrl);
    for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, { signal: controller.signal, headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/json' } });
      const text = await response.text(); let data; try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
      if (!response.ok) { const error = new Error(`SonarQube request failed (${response.status})`); error.status = response.status; throw error; }
      return data;
    } finally { clearTimeout(timer); }
  }
}
