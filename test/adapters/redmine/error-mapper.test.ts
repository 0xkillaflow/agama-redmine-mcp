import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { mapHttpError, mapSchemaError } from '../../../src/adapters/redmine/error-mapper.js';
import {
  RedmineAuthError,
  RedmineForbiddenError,
  RedmineNotFoundError,
  RedmineRateLimitError,
  RedmineTransportError,
  RedmineValidationError,
} from '../../../src/domain/errors/index.js';

describe('mapHttpError', () => {
  it('maps 401 to an auth error', () => {
    const error = mapHttpError({ status: 401, body: undefined });
    expect(error).toBeInstanceOf(RedmineAuthError);
    expect(error.status).toBe(401);
  });

  it('maps 403 to a forbidden error', () => {
    const error = mapHttpError({ status: 403, body: undefined });
    expect(error).toBeInstanceOf(RedmineForbiddenError);
    expect(error.status).toBe(403);
  });

  it('maps 404 to a not-found error', () => {
    const error = mapHttpError({ status: 404, body: undefined });
    expect(error).toBeInstanceOf(RedmineNotFoundError);
    expect(error.status).toBe(404);
  });

  it('maps 422 with a valid errors body into messages', () => {
    const error = mapHttpError({
      status: 422,
      body: { errors: ['Subject cannot be blank', 'Priority is not included in the list'] },
    });
    expect(error).toBeInstanceOf(RedmineValidationError);
    const validation = error as RedmineValidationError;
    expect(validation.messages).toEqual([
      'Subject cannot be blank',
      'Priority is not included in the list',
    ]);
    expect(validation.message).toContain('Subject cannot be blank');
    expect(validation.details).toEqual({
      errors: ['Subject cannot be blank', 'Priority is not included in the list'],
    });
  });

  it('degrades a 422 with a malformed body to a generic validation error', () => {
    const error = mapHttpError({ status: 422, body: '<html>Unprocessable</html>' });
    expect(error).toBeInstanceOf(RedmineValidationError);
    const validation = error as RedmineValidationError;
    expect(validation.messages).toEqual([]);
    expect(validation.message).toBe('Validation failed');
  });

  it('maps 406 — a rejected upload — to a validation error carrying Redmine’s messages', () => {
    // Redmine answers a refused upload (too large, disallowed type) with 406 and
    // the standard errors envelope, so it is actionable input, not a transport fault.
    const error = mapHttpError({
      status: 406,
      body: { errors: ['File is too large (maximum size is 5120 KB)'] },
    });

    expect(error).toBeInstanceOf(RedmineValidationError);
    const validation = error as RedmineValidationError;
    expect(validation.messages).toEqual(['File is too large (maximum size is 5120 KB)']);
    expect(validation.status).toBe(406);
  });

  it('maps 429 to a rate-limit error, reading Retry-After when present', () => {
    const error = mapHttpError({
      status: 429,
      body: undefined,
      headers: new Headers({ 'Retry-After': '30' }),
    });
    expect(error).toBeInstanceOf(RedmineRateLimitError);
    expect((error as RedmineRateLimitError).retryAfter).toBe(30);
  });

  it('maps 429 without a usable Retry-After to a rate-limit error with no delay', () => {
    const error = mapHttpError({
      status: 429,
      body: undefined,
      headers: new Headers({ 'Retry-After': 'Wed, 21 Oct 2026 07:28:00 GMT' }),
    });
    expect(error).toBeInstanceOf(RedmineRateLimitError);
    expect((error as RedmineRateLimitError).retryAfter).toBeUndefined();
  });

  it('maps a 500 with an HTML body to a transport error', () => {
    const html = '<html><body>Internal Server Error</body></html>';
    const error = mapHttpError({ status: 500, body: html });
    expect(error).toBeInstanceOf(RedmineTransportError);
    expect(error.status).toBe(500);
    expect(error.message).toContain('500');
    expect(error.details).toBe(html);
  });

  it('truncates an oversized text body in details', () => {
    const body = 'x'.repeat(1000);
    const error = mapHttpError({ status: 502, body });
    expect(typeof error.details).toBe('string');
    expect((error.details as string).length).toBeLessThan(body.length);
    expect(error.details).toMatch(/…$/);
  });

  it('maps an unrecognised status to a transport error', () => {
    const error = mapHttpError({ status: 418, body: undefined });
    expect(error).toBeInstanceOf(RedmineTransportError);
    expect(error.status).toBe(418);
  });

  it('preserves the originating cause', () => {
    const cause = new Error('boom');
    const error = mapHttpError({ status: 404, body: undefined, cause });
    expect(error.cause).toBe(cause);
  });
});

describe('mapSchemaError', () => {
  it('yields a transport error carrying the context and issue summary', () => {
    const result = z.object({ id: z.number() }).safeParse({ id: 'not-a-number' });
    expect(result.success).toBe(false);
    if (result.success) return;

    const error = mapSchemaError(result.error, 'get issue');
    expect(error).toBeInstanceOf(RedmineTransportError);
    expect(error.message).toBe('Unexpected response shape from Redmine');
    expect(error.cause).toBe(result.error);
    expect(error.details).toMatchObject({ context: 'get issue' });
    expect((error.details as { issues: unknown[] }).issues.length).toBeGreaterThan(0);
  });
});
