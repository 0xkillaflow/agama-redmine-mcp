import { describe, it, expect } from 'vitest';
import { createIssuesResource } from '../../../../src/adapters/redmine/resources/issues.js';
import {
  RedmineForbiddenError,
  RedmineNotFoundError,
  RedmineTransportError,
  RedmineValidationError,
} from '../../../../src/domain/errors/index.js';
import { issueSimpleFixture, listEnvelope, mockHttp } from './support.js';

describe('createIssuesResource', () => {
  it('list hits GET /issues.json with a serialized query and normalizes the page', async () => {
    const { http, get } = mockHttp();
    get.mockResolvedValue(listEnvelope('issues', [issueSimpleFixture]));
    const issues = createIssuesResource(http);

    const page = await issues.list({ project_id: '1', status_id: '1,2', include: ['attachments'] });

    expect(get).toHaveBeenCalledWith(
      '/issues.json',
      'project_id=1&status_id=1%2C2&include=attachments',
    );
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.id).toBe(42);
    expect(page.totalCount).toBe(1);
  });

  it('list normalizes a bare subject to a "~" contains filter (substring match)', async () => {
    const { http, get } = mockHttp();
    get.mockResolvedValue(listEnvelope('issues', [issueSimpleFixture]));
    const issues = createIssuesResource(http);

    await issues.list({ subject: 'пароля' });

    // `~` is URL-encoded on the wire; decodes back to the contains operator.
    const [, query] = get.mock.calls[0]!;
    expect(new URLSearchParams(query as string).get('subject')).toBe('~пароля');
  });

  it('list preserves an explicit "~" subject without double-prefixing', async () => {
    const { http, get } = mockHttp();
    get.mockResolvedValue(listEnvelope('issues', [issueSimpleFixture]));
    const issues = createIssuesResource(http);

    await issues.list({ subject: '~пароля' });

    const [, query] = get.mock.calls[0]!;
    expect(new URLSearchParams(query as string).get('subject')).toBe('~пароля');
  });

  it('get hits GET /issues/{id}.json with include and unwraps the issue envelope', async () => {
    const { http, get } = mockHttp();
    get.mockResolvedValue({ issue: { ...issueSimpleFixture, journals: [] } });
    const issues = createIssuesResource(http);

    const issue = await issues.get(42, ['journals', 'watchers']);

    expect(get).toHaveBeenCalledWith('/issues/42.json', 'include=journals%2Cwatchers');
    expect(issue.id).toBe(42);
  });

  it('get without include sends no query string', async () => {
    const { http, get } = mockHttp();
    get.mockResolvedValue({ issue: issueSimpleFixture });
    const issues = createIssuesResource(http);

    await issues.get(42);

    expect(get).toHaveBeenCalledWith('/issues/42.json', '');
  });

  it('create POSTs the { issue } envelope and returns the parsed issue', async () => {
    const { http, post } = mockHttp();
    post.mockResolvedValue({ issue: issueSimpleFixture });
    const issues = createIssuesResource(http);

    const created = await issues.create({ project_id: 1, subject: 'New bug' });

    expect(post).toHaveBeenCalledWith('/issues.json', {
      issue: { project_id: 1, subject: 'New bug' },
    });
    expect(created.id).toBe(42);
  });

  it('update PUTs the { issue } envelope and resolves void on 204', async () => {
    const { http, put } = mockHttp();
    put.mockResolvedValue(undefined);
    const issues = createIssuesResource(http);

    const result = await issues.update(42, { subject: 'Renamed' });

    expect(put).toHaveBeenCalledWith('/issues/42.json', { issue: { subject: 'Renamed' } });
    expect(result).toBeUndefined();
  });

  it('delete hits DELETE /issues/{id}.json and resolves void on 204', async () => {
    const { http, del } = mockHttp();
    del.mockResolvedValue(undefined);
    const issues = createIssuesResource(http);

    const result = await issues.delete(42);

    expect(del).toHaveBeenCalledWith('/issues/42.json');
    expect(result).toBeUndefined();
  });

  it('propagates a not-found error raised by the requester on a delete', async () => {
    const { http, del } = mockHttp();
    del.mockRejectedValue(new RedmineNotFoundError());
    const issues = createIssuesResource(http);

    await expect(issues.delete(999)).rejects.toBeInstanceOf(RedmineNotFoundError);
  });

  it('addWatcher POSTs a bare { user_id } body — no named envelope', async () => {
    const { http, post } = mockHttp();
    post.mockResolvedValue(undefined);
    const issues = createIssuesResource(http);

    await issues.addWatcher(42, 7);

    expect(post).toHaveBeenCalledWith('/issues/42/watchers.json', { user_id: 7 });
  });

  it('removeWatcher hits DELETE /issues/{id}/watchers/{user_id}.json', async () => {
    const { http, del } = mockHttp();
    del.mockResolvedValue(undefined);
    const issues = createIssuesResource(http);

    await issues.removeWatcher(42, 7);

    expect(del).toHaveBeenCalledWith('/issues/42/watchers/7.json');
  });

  it('propagates a forbidden error raised by the requester on a watcher change', async () => {
    const { http, post } = mockHttp();
    post.mockRejectedValue(new RedmineForbiddenError());
    const issues = createIssuesResource(http);

    // Managing watchers needs a distinct permission, so a 403 is the common case.
    await expect(issues.addWatcher(42, 7)).rejects.toBeInstanceOf(RedmineForbiddenError);
  });

  it('turns a schema-mismatched body into a transport error', async () => {
    const { http, get } = mockHttp();
    get.mockResolvedValue(listEnvelope('issues', [{ id: 'not-a-number' }]));
    const issues = createIssuesResource(http);

    await expect(issues.list({})).rejects.toBeInstanceOf(RedmineTransportError);
  });

  it('propagates a validation error raised by the requester on a 422 create', async () => {
    const { http, post } = mockHttp();
    post.mockRejectedValue(new RedmineValidationError(['Subject cannot be blank']));
    const issues = createIssuesResource(http);

    await expect(issues.create({ project_id: 1, subject: '' })).rejects.toBeInstanceOf(
      RedmineValidationError,
    );
  });
});
