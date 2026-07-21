import { describe, it, expect } from 'vitest';
import { SearchResultSchema, SearchParamsSchema } from '../../../src/domain/models/search.js';
import { paginated } from '../../../src/domain/models/common.js';

describe('SearchResultSchema', () => {
  it('parses a search hit', () => {
    const hit = {
      id: 456,
      title: 'Bug #456: crash on save',
      type: 'issue-closed',
      url: 'https://redmine.example.com/issues/456',
      description: 'Stack trace…',
      datetime: '2024-01-01T10:00:00Z',
    };
    expect(SearchResultSchema.parse(hit)).toEqual(hit);
  });

  it('normalizes a multi-type result set via paginated("results")', () => {
    const page = paginated('results', SearchResultSchema).parse({
      results: [
        {
          id: 456,
          title: 'Bug #456',
          type: 'issue',
          url: 'https://r/issues/456',
          description: '',
          datetime: '2024-01-01T10:00:00Z',
        },
        {
          id: 12,
          title: 'Release notes',
          type: 'wiki-page',
          url: 'https://r/wiki/12',
          description: '',
          datetime: '2024-01-02T10:00:00Z',
        },
      ],
      total_count: 2,
      offset: 0,
      limit: 25,
    });
    expect(page.items).toHaveLength(2);
    expect(page.items[1]?.type).toBe('wiki-page');
    expect(page.totalCount).toBe(2);
  });
});

describe('SearchParamsSchema', () => {
  it('requires q', () => {
    expect(SearchParamsSchema.safeParse({}).success).toBe(false);
  });

  it('accepts q with boolean flags, scope and attachments', () => {
    const parsed = SearchParamsSchema.parse({
      q: 'dark mode',
      scope: 'subprojects',
      issues: true,
      open_issues: true,
      titles_only: false,
      attachments: 'only',
      offset: 0,
      limit: 25,
    });
    expect(parsed.q).toBe('dark mode');
    expect(parsed.issues).toBe(true);
    expect(parsed.attachments).toBe('only');
  });

  it('rejects an invalid attachments value', () => {
    expect(SearchParamsSchema.safeParse({ q: 'x', attachments: 'maybe' }).success).toBe(false);
  });

  it('rejects an invalid scope value', () => {
    expect(SearchParamsSchema.safeParse({ q: 'x', scope: 'global' }).success).toBe(false);
  });
});
