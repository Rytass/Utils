import { CloudflareApiError, CloudflareSendResponse } from './typings';

const describe = (errors: readonly CloudflareApiError[] | undefined): string =>
  errors && errors.length > 0 ? errors.map(error => `[${error.code}] ${error.message}`).join('; ') : 'unknown error';

/**
 * Error thrown when the Cloudflare Email Service rejects a send, or when every
 * recipient permanently bounces. Carries the HTTP status and the raw
 * Cloudflare `errors` array for programmatic handling.
 */
export class CloudflareEmailError extends Error {
  public readonly httpStatus: number;
  public readonly errors: readonly CloudflareApiError[];

  constructor(message: string, httpStatus: number, errors: readonly CloudflareApiError[]) {
    super(message);
    this.name = 'CloudflareEmailError';
    this.httpStatus = httpStatus;
    this.errors = errors;

    // Restore the prototype chain for instances built under transpiled targets.
    Object.setPrototypeOf(this, CloudflareEmailError.prototype);
  }

  static fromResponse(httpStatus: number, body: CloudflareSendResponse): CloudflareEmailError {
    const errors = body.errors ?? [];

    return new CloudflareEmailError(`Cloudflare Email Service request failed: ${describe(errors)}`, httpStatus, errors);
  }

  static allBounced(
    httpStatus: number,
    body: CloudflareSendResponse,
    rejected: readonly string[],
  ): CloudflareEmailError {
    return new CloudflareEmailError(
      `Cloudflare Email Service: all recipient(s) permanently bounced (${rejected.join(', ')})`,
      httpStatus,
      body.errors ?? [],
    );
  }
}
