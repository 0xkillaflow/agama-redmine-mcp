import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  IdNameSchema,
  IssueStatusRefSchema,
  CustomFieldValueSchema,
  AttachmentRefSchema,
  RedmineErrorsBodySchema,
  paginated,
  includeSchema,
} from '../../../src/domain/models/common.js';

describe('IdNameSchema', () => {
  it('parses a valid id/name reference', () => {
    expect(IdNameSchema.parse({ id: 1, name: 'Bug' })).toEqual({ id: 1, name: 'Bug' });
  });

  it('rejects a missing name', () => {
    expect(IdNameSchema.safeParse({ id: 1 }).success).toBe(false);
  });
});

describe('IssueStatusRefSchema', () => {
  it('parses a status reference with its closed flag', () => {
    const status = { id: 5, name: 'Closed', is_closed: true };
    expect(IssueStatusRefSchema.parse(status)).toEqual(status);
  });

  it('rejects a status without is_closed', () => {
    expect(IssueStatusRefSchema.safeParse({ id: 5, name: 'Closed' }).success).toBe(false);
  });
});

describe('CustomFieldValueSchema', () => {
  it('accepts a scalar string value', () => {
    const parsed = CustomFieldValueSchema.parse({ id: 1, name: 'Severity', value: 'High' });
    expect(parsed.value).toBe('High');
  });

  it('accepts an array value with multiple=true', () => {
    const parsed = CustomFieldValueSchema.parse({
      id: 2,
      name: 'Tags',
      multiple: true,
      value: ['a', 'b'],
    });
    expect(parsed.value).toEqual(['a', 'b']);
    expect(parsed.multiple).toBe(true);
  });

  it('accepts an explicit null value', () => {
    const parsed = CustomFieldValueSchema.parse({ id: 3, name: 'Optional', value: null });
    expect(parsed.value).toBeNull();
  });

  it('accepts an absent value', () => {
    const parsed = CustomFieldValueSchema.parse({ id: 4, name: 'NoValue' });
    expect(parsed.value).toBeUndefined();
  });

  it('rejects a numeric value', () => {
    expect(CustomFieldValueSchema.safeParse({ id: 5, name: 'X', value: 42 }).success).toBe(false);
  });
});

describe('AttachmentRefSchema', () => {
  const attachment = {
    id: 10,
    filename: 'diagram.png',
    filesize: 2048,
    content_type: 'image/png',
    description: 'architecture',
    content_url: 'https://redmine.example.com/attachments/download/10/diagram.png',
    thumbnail_url: 'https://redmine.example.com/attachments/thumbnail/10',
    author: { id: 3, name: 'Jane Doe' },
    created_on: '2024-01-01T10:00:00Z',
  };

  it('parses a full attachment', () => {
    expect(AttachmentRefSchema.parse(attachment)).toEqual(attachment);
  });

  it('parses an attachment without the optional thumbnail_url', () => {
    const { thumbnail_url, ...withoutThumb } = attachment;
    void thumbnail_url;
    expect(AttachmentRefSchema.parse(withoutThumb).thumbnail_url).toBeUndefined();
  });

  it('rejects an attachment missing a required field', () => {
    const { filesize, ...invalid } = attachment;
    void filesize;
    expect(AttachmentRefSchema.safeParse(invalid).success).toBe(false);
  });
});

describe('RedmineErrorsBodySchema', () => {
  it('parses the Redmine error envelope', () => {
    expect(RedmineErrorsBodySchema.parse({ errors: ['a', 'b'] })).toEqual({ errors: ['a', 'b'] });
  });

  it('rejects a non-array errors field', () => {
    expect(RedmineErrorsBodySchema.safeParse({ errors: 'oops' }).success).toBe(false);
  });
});

describe('paginated', () => {
  const IssuesPage = paginated('issues', IdNameSchema);

  it('normalizes a resource-named array into items and preserves counts', () => {
    const parsed = IssuesPage.parse({
      issues: [
        { id: 1, name: 'One' },
        { id: 2, name: 'Two' },
      ],
      total_count: 42,
      offset: 10,
      limit: 25,
    });

    expect(parsed).toEqual({
      items: [
        { id: 1, name: 'One' },
        { id: 2, name: 'Two' },
      ],
      totalCount: 42,
      offset: 10,
      limit: 25,
    });
  });

  it('defaults total_count/offset/limit sensibly when omitted', () => {
    const parsed = IssuesPage.parse({ issues: [{ id: 1, name: 'One' }] });

    expect(parsed.totalCount).toBe(1);
    expect(parsed.offset).toBe(0);
    expect(parsed.limit).toBe(1);
  });

  it('validates each item against the element schema', () => {
    expect(IssuesPage.safeParse({ issues: [{ id: 'nope', name: 'One' }] }).success).toBe(false);
  });

  it('requires the named array to be present', () => {
    expect(IssuesPage.safeParse({ total_count: 0 }).success).toBe(false);
  });
});

describe('includeSchema', () => {
  const schema = includeSchema(['journals', 'attachments', 'relations']);

  it('parses an array of valid include values', () => {
    expect(schema.parse(['journals', 'relations'])).toEqual(['journals', 'relations']);
  });

  it('rejects an unknown include value', () => {
    expect(schema.safeParse(['unknown']).success).toBe(false);
  });

  it('infers a union element type', () => {
    type Element = z.infer<typeof schema>[number];
    const value: Element = 'journals';
    expect(value).toBe('journals');
  });
});
