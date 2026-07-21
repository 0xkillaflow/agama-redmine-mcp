import { describe, it, expect } from 'vitest';
import {
  RedmineError,
  RedmineAuthError,
  RedmineForbiddenError,
  RedmineNotFoundError,
  RedmineValidationError,
  RedmineRateLimitError,
  RedmineTransportError,
  NotImplementedError,
  isRedmineError,
} from '../../../src/domain/errors/index.js';

describe('domain error model', () => {
  it('constructs each error with the expected name, code, and status', () => {
    const cases = [
      { err: new RedmineAuthError(), name: 'RedmineAuthError', code: 'REDMINE_AUTH', status: 401 },
      {
        err: new RedmineForbiddenError(),
        name: 'RedmineForbiddenError',
        code: 'REDMINE_FORBIDDEN',
        status: 403,
      },
      {
        err: new RedmineNotFoundError(),
        name: 'RedmineNotFoundError',
        code: 'REDMINE_NOT_FOUND',
        status: 404,
      },
      {
        err: new RedmineValidationError(['bad']),
        name: 'RedmineValidationError',
        code: 'REDMINE_VALIDATION',
        status: 422,
      },
      {
        err: new RedmineRateLimitError(),
        name: 'RedmineRateLimitError',
        code: 'REDMINE_RATE_LIMIT',
        status: 429,
      },
    ] as const;

    for (const { err, name, code, status } of cases) {
      expect(err.name).toBe(name);
      expect(err.code).toBe(code);
      expect(err.status).toBe(status);
    }
  });

  it('holds `instanceof RedmineError` (and Error) for every subclass', () => {
    const errors = [
      new RedmineAuthError(),
      new RedmineForbiddenError(),
      new RedmineNotFoundError(),
      new RedmineValidationError(['x']),
      new RedmineRateLimitError(),
      new RedmineTransportError(),
    ];

    for (const err of errors) {
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(RedmineError);
    }
  });

  it('preserves the concrete instanceof for each subclass', () => {
    expect(new RedmineAuthError()).toBeInstanceOf(RedmineAuthError);
    expect(new RedmineNotFoundError()).toBeInstanceOf(RedmineNotFoundError);
    expect(new RedmineTransportError()).not.toBeInstanceOf(RedmineAuthError);
  });

  it('exposes validation messages on RedmineValidationError', () => {
    const err = new RedmineValidationError(['Subject cannot be blank', 'Priority is invalid']);

    expect(err.messages).toEqual(['Subject cannot be blank', 'Priority is invalid']);
    // The human message concatenates the individual messages.
    expect(err.message).toBe('Subject cannot be blank; Priority is invalid');
  });

  it('defaults an empty validation message list to a readable message', () => {
    expect(new RedmineValidationError([]).message).toBe('Validation failed');
  });

  it('carries an optional retryAfter on RedmineRateLimitError', () => {
    expect(new RedmineRateLimitError().retryAfter).toBeUndefined();
    expect(new RedmineRateLimitError('slow down', { retryAfter: 30 }).retryAfter).toBe(30);
  });

  it('leaves RedmineTransportError without a fixed status but accepts one', () => {
    expect(new RedmineTransportError().status).toBeUndefined();
    expect(new RedmineTransportError('server error', { status: 503 }).status).toBe(503);
  });

  it('round-trips details and cause', () => {
    const cause = new Error('socket hang up');
    const details = { url: 'https://redmine.example.com/issues.json' };
    const err = new RedmineTransportError('network failure', { cause, details });

    expect(err.details).toBe(details);
    expect(err.cause).toBe(cause);
  });

  it('narrows with isRedmineError and excludes non-domain errors', () => {
    expect(isRedmineError(new RedmineNotFoundError())).toBe(true);
    expect(isRedmineError(new Error('plain'))).toBe(false);
    expect(isRedmineError(new NotImplementedError())).toBe(false);
    expect(isRedmineError('not-an-error')).toBe(false);
    expect(isRedmineError(null)).toBe(false);
  });

  it('models NotImplementedError as a plain Error outside the Redmine hierarchy', () => {
    const err = new NotImplementedError('http transport not available');

    expect(err).toBeInstanceOf(NotImplementedError);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(RedmineError);
    expect(err.name).toBe('NotImplementedError');
    expect(err.code).toBe('NOT_IMPLEMENTED');
  });
});
