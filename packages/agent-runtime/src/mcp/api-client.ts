/**
 * HTTP client for calling the AI Jam backend REST API.
 * Injects auth token and MCP source header on every request.
 */

export interface ApiClientConfig {
  baseUrl: string;
  authToken: string;
  sessionId: string;
}

export class ApiClient {
  private baseUrl: string;
  private authToken: string;
  private sessionId: string;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.authToken = config.authToken;
    this.sessionId = config.sessionId;
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.authToken}`,
      'X-AI-Jam-Source': 'mcp',
      'X-AI-Jam-Session': this.sessionId,
    };
  }

  async get<T = unknown>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: this.headers(),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GET ${path} failed (${res.status}): ${body}`);
    }
    return res.json() as Promise<T>;
  }

  async post<T = unknown>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`POST ${path} failed (${res.status}): ${text}`);
    }
    return res.json() as Promise<T>;
  }

  async patch<T = unknown>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'PATCH',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`PATCH ${path} failed (${res.status}): ${text}`);
    }
    return res.json() as Promise<T>;
  }
}
