import { describe, it, expect } from 'vitest';
import {
  toQuery,
  csv,
  flag,
  cfParams,
  textContains,
  type QueryParams,
} from '../../../src/adapters/redmine/request-builder.js';

/** Parse a query string back into a lookup so assertions read on decoded values. */
const parse = (query: string): URLSearchParams => new URLSearchParams(query);

describe('request-builder helpers', () => {
  it('csv comma-joins arrays (explode:false)', () => {
    expect(csv([1, 2, 3])).toBe('1,2,3');
    expect(csv(['a', 'b'])).toBe('a,b');
    expect(csv([])).toBe('');
  });

  it('flag encodes true as "1" and false as undefined', () => {
    expect(flag(true)).toBe('1');
    expect(flag(false)).toBeUndefined();
  });

  it('cfParams expands a custom-field map into cf_<id> keys', () => {
    expect(cfParams({ '2': 'x', '7': 'y' })).toEqual({ cf_2: 'x', cf_7: 'y' });
    expect(cfParams({})).toEqual({});
  });

  it('textContains defaults a bare value to the "~" contains operator', () => {
    expect(textContains('пароля')).toBe('~пароля');
    expect(textContains('login bug')).toBe('~login bug');
  });

  it('textContains leaves an explicit "~" value and empty string unchanged', () => {
    expect(textContains('~пароля')).toBe('~пароля');
    expect(textContains('')).toBe('');
  });
});

describe('toQuery', () => {
  it('returns an empty string for empty params', () => {
    expect(toQuery({})).toBe('');
  });

  it('comma-joins array values including include lists', () => {
    const q = parse(toQuery({ status_id: [1, 2], include: ['journals', 'watchers'] }));
    expect(q.get('status_id')).toBe('1,2');
    expect(q.get('include')).toBe('journals,watchers');
  });

  it('skips empty arrays rather than emitting a bare key', () => {
    expect(toQuery({ include: [] })).toBe('');
  });

  it('expands the custom_fields map into cf_<id> keys', () => {
    const q = parse(toQuery({ custom_fields: { '2': 'urgent', '5': 'blue' } }));
    expect(q.get('cf_2')).toBe('urgent');
    expect(q.get('cf_5')).toBe('blue');
    expect(q.has('custom_fields')).toBe(false);
  });

  it('omits false booleans and sends true as "1"', () => {
    const q = parse(toQuery({ is_public: true, open_issues: false }));
    expect(q.get('is_public')).toBe('1');
    expect(q.has('open_issues')).toBe(false);
  });

  it('skips undefined and null but keeps 0 and empty strings', () => {
    const q = parse(toQuery({ a: undefined, b: null, offset: 0, subject: '' } as QueryParams));
    expect(q.has('a')).toBe(false);
    expect(q.has('b')).toBe(false);
    expect(q.get('offset')).toBe('0');
    expect(q.get('subject')).toBe('');
  });

  it('passes operator-prefixed date strings through intact (URL-encoded)', () => {
    const raw = toQuery({ created_on: '>=2024-01-01', due_date: '><2024-01-01|2024-12-31' });
    // Encoded on the wire…
    expect(raw).toContain('created_on=%3E%3D2024-01-01');
    // …and decodes back to the exact operator string.
    const q = parse(raw);
    expect(q.get('created_on')).toBe('>=2024-01-01');
    expect(q.get('due_date')).toBe('><2024-01-01|2024-12-31');
  });

  it('serializes a realistic list_issues param set', () => {
    const params: QueryParams = {
      project_id: '10',
      status_id: '1,2',
      assigned_to_id: 'me',
      created_on: '>=2024-01-01',
      sort: 'updated_on:desc',
      include: ['attachments', 'journals'],
      offset: 0,
      limit: 25,
      custom_fields: { '3': 'high' },
    };
    const q = parse(toQuery(params));

    expect(q.get('project_id')).toBe('10');
    expect(q.get('status_id')).toBe('1,2');
    expect(q.get('assigned_to_id')).toBe('me');
    expect(q.get('created_on')).toBe('>=2024-01-01');
    expect(q.get('sort')).toBe('updated_on:desc');
    expect(q.get('include')).toBe('attachments,journals');
    expect(q.get('offset')).toBe('0');
    expect(q.get('limit')).toBe('25');
    expect(q.get('cf_3')).toBe('high');
  });
});
