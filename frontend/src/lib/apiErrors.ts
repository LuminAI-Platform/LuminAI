export class ApiTimeoutError extends Error {
  public readonly status: number = 504;
  public readonly timeoutMs: number;
  public readonly url: string;

  constructor(timeoutMs: number, url: string) {
    super(
      `Request timed out after ${timeoutMs}ms: Data Engine service did not respond within ${Math.round(timeoutMs / 1000)}s`,
    );
    this.name = "ApiTimeoutError";
    this.timeoutMs = timeoutMs;
    this.url = url;
  }

  get isTimeout(): boolean {
    return true;
  }
}

/**
 * Thrown when the server responds with a non-2xx status code.
 * Carries the original `Response` so callers can inspect status / body.
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly response: Response;

  constructor(response: Response) {
    super(`API error: ${response.status} ${response.statusText}`);
    this.name = "ApiError";
    this.status = response.status;
    this.response = response;
  }

  /** Convenience: returns true when the request was rejected due to auth */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }
}
