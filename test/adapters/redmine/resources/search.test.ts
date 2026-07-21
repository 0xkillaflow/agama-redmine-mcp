import { describe, it, expect } from 'vitest';
import { createSearchResource } from '../../../../src/adapters/redmine/resources/search.js';
import { RedmineTransportError } from '../../../../src/domain/errors/index.js';
import { listEnvelope, mockHttp, searchResultFixture } from './support.js';

describe('createSearchResource', () => {
  it('search hits GET /search.json, serializing boolean flags as 1 / omitted', async () => {
    const { http, get } = mockHttp();
    get.mockResolvedValue(listEnvelope('results', [searchResultFixture]));
    const search = createSearchResource(http);

    const page = await search.search({ q: 'login', issues: true, open_issues: false });

    // `issues:true` → `issues=1`; `open_issues:false` is omitted entirely.
    expect(get).toHaveBeenCalledWith('/search.json', 'q=login&issues=1');
    expect(page.items[0]?.type).toBe('issue');
  });

  it('turns a schema-mismatched body into a transport error', async () => {
    const { http, get } = mockHttp();
    get.mockResolvedValue(listEnvelope('results', [{ id: 1 }]));
    const search = createSearchResource(http);

    await expect(search.search({ q: 'x' })).rejects.toBeInstanceOf(RedmineTransportError);
  });
});
