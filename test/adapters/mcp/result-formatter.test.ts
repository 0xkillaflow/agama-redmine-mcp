import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { formatError, formatSuccess } from '../../../src/adapters/mcp/result-formatter.js';
import {
  RedmineAuthError,
  RedmineForbiddenError,
  RedmineNotFoundError,
  RedmineRateLimitError,
  RedmineTransportError,
  RedmineValidationError,
} from '../../../src/domain/errors/index.js';

/** Extract the text of the first content block. */
function firstText(result: { content: Array<{ type: string; text?: string }> }): string {
  const block = result.content[0];
  expect(block?.type).toBe('text');
  return block?.text ?? '';
}

describe('formatSuccess', () => {
  it('serializes an object value into text and structuredContent', () => {
    const value = { items: [1, 2], totalCount: 2 };
    const result = formatSuccess(value);
    expect(firstText(result)).toBe(JSON.stringify(value));
    expect(result.structuredContent).toEqual(value);
    expect(result.isError).toBeUndefined();
  });

  it('omits structuredContent for an array value', () => {
    const result = formatSuccess([1, 2, 3]);
    expect(firstText(result)).toBe('[1,2,3]');
    expect(result.structuredContent).toBeUndefined();
  });

  it('omits structuredContent for a primitive value', () => {
    const result = formatSuccess(42);
    expect(firstText(result)).toBe('42');
    expect(result.structuredContent).toBeUndefined();
  });

  it('omits structuredContent for null', () => {
    const result = formatSuccess(null);
    expect(firstText(result)).toBe('null');
    expect(result.structuredContent).toBeUndefined();
  });
});

describe('formatError', () => {
  it('sets isError and a text message', () => {
    const result = formatError(new RedmineNotFoundError());
    expect(result.isError).toBe(true);
    expect(firstText(result).length).toBeGreaterThan(0);
  });

  it('produces a distinct message for each RedmineError subtype', () => {
    const messages = {
      auth: firstText(formatError(new RedmineAuthError())),
      forbidden: firstText(formatError(new RedmineForbiddenError())),
      notFound: firstText(formatError(new RedmineNotFoundError())),
      validation: firstText(formatError(new RedmineValidationError(['Subject cannot be blank']))),
      rateLimit: firstText(formatError(new RedmineRateLimitError())),
      transport: firstText(formatError(new RedmineTransportError('connection reset'))),
    };
    const distinct = new Set(Object.values(messages));
    expect(distinct.size).toBe(Object.keys(messages).length);
  });

  it('includes the Redmine validation messages', () => {
    const result = formatError(
      new RedmineValidationError(['Subject cannot be blank', 'Priority is invalid']),
    );
    const text = firstText(result);
    expect(text).toContain('Subject cannot be blank');
    expect(text).toContain('Priority is invalid');
  });

  it('reports the retry delay for a rate-limit error when present', () => {
    const withDelay = firstText(
      formatError(new RedmineRateLimitError('slow down', { retryAfter: 30 })),
    );
    expect(withDelay).toContain('30');
    const noDelay = firstText(formatError(new RedmineRateLimitError()));
    expect(noDelay).toMatch(/retry/i);
  });

  it('surfaces the transport error message', () => {
    const text = firstText(formatError(new RedmineTransportError('request timed out')));
    expect(text).toContain('request timed out');
  });

  it('reports unknown errors generically without leaking internals', () => {
    const text = firstText(formatError(new Error('secret stack detail')));
    expect(text).not.toContain('secret stack detail');
    expect(text).toMatch(/internal error/i);
  });

  it('formats a tool-input ZodError (cross-field XOR) as a clear "Invalid input" message', () => {
    const schema = z
      .object({ issue_id: z.number().optional(), project_id: z.number().optional() })
      .superRefine((value, ctx) => {
        if ((value.issue_id !== undefined) === (value.project_id !== undefined)) {
          ctx.addIssue({
            code: 'custom',
            message: 'Provide exactly one of issue_id or project_id.',
            path: ['issue_id'],
          });
        }
      });
    const parsed = schema.safeParse({});
    if (parsed.success) throw new Error('expected a validation failure');

    const text = firstText(formatError(parsed.error));
    expect(text).toMatch(/invalid input/i);
    expect(text).toContain('Provide exactly one of issue_id or project_id.');
    expect(text).toContain('issue_id');
    // The XOR message must not collapse to the generic internal-error text.
    expect(text).not.toMatch(/internal error/i);
  });

  it('enriches the cascading blank-project 422 with a project_id hint', () => {
    const text = firstText(
      formatError(
        new RedmineValidationError([
          'Project cannot be blank',
          'Tracker cannot be blank',
          'Status cannot be blank',
        ]),
      ),
    );
    expect(text).toContain('Project cannot be blank');
    expect(text).toMatch(/verify project_id/i);
  });

  it('does not add the project hint to unrelated validation errors', () => {
    const text = firstText(formatError(new RedmineValidationError(['Subject cannot be blank'])));
    expect(text).toContain('Subject cannot be blank');
    expect(text).not.toMatch(/verify project_id/i);
  });
});
