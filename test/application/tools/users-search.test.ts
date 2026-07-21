import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import { getCurrentUserTool } from '../../../src/application/tools/users/get-current-user.tool.js';
import { searchTool } from '../../../src/application/tools/search/search.tool.js';
import { userFixture, searchResultFixture } from '../../adapters/redmine/resources/support.js';
import { fakeRedmineClient, toolContext, emptyPage } from './support.js';

describe('redmine_get_current_user', () => {
  it('is read-only', () => {
    expect(getCurrentUserTool.annotations?.readOnlyHint).toBe(true);
  });

  it('forwards include to users.getCurrent', async () => {
    const client = fakeRedmineClient();
    client.users.getCurrent.mockResolvedValue(userFixture);

    const result = await getCurrentUserTool.handle(
      { include: ['memberships', 'groups'] },
      toolContext(client),
    );

    expect(client.users.getCurrent).toHaveBeenCalledWith(['memberships', 'groups']);
    expect(result).toBe(userFixture);
  });

  it('passes undefined when no include is given', async () => {
    const client = fakeRedmineClient();
    client.users.getCurrent.mockResolvedValue(userFixture);

    await getCurrentUserTool.handle({}, toolContext(client));

    expect(client.users.getCurrent).toHaveBeenCalledWith(undefined);
  });
});

describe('redmine_search', () => {
  it('is read-only', () => {
    expect(searchTool.annotations?.readOnlyHint).toBe(true);
  });

  it('passes the query and flags through to search.search', async () => {
    const client = fakeRedmineClient();
    client.search.search.mockResolvedValue(emptyPage());
    const input = {
      q: 'login bug',
      scope: 'subprojects' as const,
      issues: true,
      open_issues: true,
    };

    const result = await searchTool.handle(input, toolContext(client));

    expect(client.search.search).toHaveBeenCalledWith(input);
    expect(result).toEqual(emptyPage());
  });

  it('returns the search results', async () => {
    const client = fakeRedmineClient();
    client.search.search.mockResolvedValue({
      items: [searchResultFixture],
      totalCount: 1,
      offset: 0,
      limit: 25,
    });

    const result = await searchTool.handle({ q: 'login' }, toolContext(client));

    expect(result.items).toEqual([searchResultFixture]);
  });

  it('rejects a missing q via the schema', () => {
    // `q` is required; the SDK validates arguments against inputSchema before the
    // handler runs, so parsing the shape rejects an absent query.
    expect(() => searchTool.inputSchema.q.parse(undefined)).toThrow(ZodError);
  });
});
