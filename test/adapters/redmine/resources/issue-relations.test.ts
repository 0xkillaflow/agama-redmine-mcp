import { describe, it, expect } from 'vitest';
import { createIssueRelationsResource } from '../../../../src/adapters/redmine/resources/issue-relations.js';
import {
  RedmineNotFoundError,
  RedmineTransportError,
  RedmineValidationError,
} from '../../../../src/domain/errors/index.js';
import { mockHttp } from './support.js';

/** A schema-valid `relation`: #17 blocks #42. */
const relationFixture = {
  id: 9,
  issue_id: 17,
  issue_to_id: 42,
  relation_type: 'blocks',
  delay: null,
} as const;

describe('createIssueRelationsResource', () => {
  it('listForIssue hits GET /issues/{id}/relations.json and parses the plural key', async () => {
    const { http, get } = mockHttp();
    get.mockResolvedValue({ relations: [relationFixture] });
    const relations = createIssueRelationsResource(http);

    const result = await relations.listForIssue(17);

    expect(get).toHaveBeenCalledWith('/issues/17/relations.json');
    expect(result).toEqual([relationFixture]);
  });

  it('listForIssue returns a plain array — not a paginated page', async () => {
    const { http, get } = mockHttp();
    // The endpoint documents no total_count/offset/limit; a page here would be
    // fabricated, so the array must come back as-is.
    get.mockResolvedValue({ relations: [relationFixture] });
    const relations = createIssueRelationsResource(http);

    const result = await relations.listForIssue(17);

    expect(Array.isArray(result)).toBe(true);
    expect(result).not.toHaveProperty('totalCount');
  });

  it('listForIssue keeps relations where the queried issue is the target', async () => {
    const { http, get } = mockHttp();
    // Redmine lists a relation under both issues; from #42's perspective the
    // fixture's issue_id (17) is the *other* side.
    get.mockResolvedValue({ relations: [relationFixture] });
    const relations = createIssueRelationsResource(http);

    const result = await relations.listForIssue(42);

    expect(get).toHaveBeenCalledWith('/issues/42/relations.json');
    expect(result[0]?.issue_id).toBe(17);
    expect(result[0]?.issue_to_id).toBe(42);
  });

  it('get hits GET /relations/{id}.json and parses the singular key', async () => {
    const { http, get } = mockHttp();
    get.mockResolvedValue({ relation: relationFixture });
    const relations = createIssueRelationsResource(http);

    const relation = await relations.get(9);

    // Top-level path, singular envelope — the asymmetry with listForIssue.
    expect(get).toHaveBeenCalledWith('/relations/9.json');
    expect(relation.id).toBe(9);
  });

  it('create POSTs the { relation } envelope and parses the created relation', async () => {
    const { http, post } = mockHttp();
    post.mockResolvedValue({ relation: relationFixture });
    const relations = createIssueRelationsResource(http);

    const created = await relations.create(17, { issue_to_id: 42, relation_type: 'blocks' });

    expect(post).toHaveBeenCalledWith('/issues/17/relations.json', {
      relation: { issue_to_id: 42, relation_type: 'blocks' },
    });
    expect(created).toEqual(relationFixture);
  });

  it('create carries delay for a precedes relation', async () => {
    const { http, post } = mockHttp();
    post.mockResolvedValue({
      relation: { ...relationFixture, relation_type: 'precedes', delay: 2 },
    });
    const relations = createIssueRelationsResource(http);

    const created = await relations.create(17, {
      issue_to_id: 42,
      relation_type: 'precedes',
      delay: 2,
    });

    expect(post).toHaveBeenCalledWith('/issues/17/relations.json', {
      relation: { issue_to_id: 42, relation_type: 'precedes', delay: 2 },
    });
    expect(created.delay).toBe(2);
  });

  it('delete hits the top-level DELETE /relations/{id}.json and resolves void', async () => {
    const { http, del } = mockHttp();
    del.mockResolvedValue(undefined);
    const relations = createIssueRelationsResource(http);

    const result = await relations.delete(9);

    // Not /issues/{id}/relations/{id}.json — the issue-scoped path is GET/POST only.
    expect(del).toHaveBeenCalledWith('/relations/9.json');
    expect(result).toBeUndefined();
  });

  it('propagates a not-found error raised by the requester on a delete', async () => {
    const { http, del } = mockHttp();
    del.mockRejectedValue(new RedmineNotFoundError());
    const relations = createIssueRelationsResource(http);

    await expect(relations.delete(999)).rejects.toBeInstanceOf(RedmineNotFoundError);
  });

  it('propagates a validation error raised by the requester on a 422 create', async () => {
    const { http, post } = mockHttp();
    // Redmine's own judgement (self-relation, duplicate, circular precedes) —
    // its messages travel through untouched.
    post.mockRejectedValue(new RedmineValidationError(['Issue is invalid']));
    const relations = createIssueRelationsResource(http);

    await expect(
      relations.create(17, { issue_to_id: 17, relation_type: 'blocks' }),
    ).rejects.toBeInstanceOf(RedmineValidationError);
  });

  it('turns a schema-mismatched body into a transport error', async () => {
    const { http, get } = mockHttp();
    get.mockResolvedValue({ relations: [{ id: 'not-a-number' }] });
    const relations = createIssueRelationsResource(http);

    await expect(relations.listForIssue(17)).rejects.toBeInstanceOf(RedmineTransportError);
  });

  it('rejects a list body carrying the singular key (and vice versa)', async () => {
    const { http, get } = mockHttp();
    // Guards the envelope-key asymmetry: mixing them up must fail loudly.
    get.mockResolvedValue({ relation: relationFixture });
    const relations = createIssueRelationsResource(http);

    await expect(relations.listForIssue(17)).rejects.toBeInstanceOf(RedmineTransportError);

    get.mockResolvedValue({ relations: [relationFixture] });
    await expect(relations.get(9)).rejects.toBeInstanceOf(RedmineTransportError);
  });
});
