import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import { listIssuesTool } from '../../../src/application/tools/issues/list-issues.tool.js';
import { getIssueTool } from '../../../src/application/tools/issues/get-issue.tool.js';
import { createIssueTool } from '../../../src/application/tools/issues/create-issue.tool.js';
import { updateIssueTool } from '../../../src/application/tools/issues/update-issue.tool.js';
import { deleteIssueTool } from '../../../src/application/tools/issues/delete-issue.tool.js';
import { manageIssueWatchersTool } from '../../../src/application/tools/issues/manage-issue-watchers.tool.js';
import { listIssueRelationsTool } from '../../../src/application/tools/issues/list-issue-relations.tool.js';
import { createIssueRelationTool } from '../../../src/application/tools/issues/create-issue-relation.tool.js';
import { deleteIssueRelationTool } from '../../../src/application/tools/issues/delete-issue-relation.tool.js';
import {
  RedmineForbiddenError,
  RedmineNotFoundError,
  RedmineValidationError,
} from '../../../src/domain/errors/index.js';
import { issueSimpleFixture } from '../../adapters/redmine/resources/support.js';
import { fakeRedmineClient, toolContext, emptyPage } from './support.js';

describe('redmine_list_issues', () => {
  it('is read-only', () => {
    expect(listIssuesTool.annotations?.readOnlyHint).toBe(true);
  });

  it('passes filters straight through to issues.list', async () => {
    const client = fakeRedmineClient();
    client.issues.list.mockResolvedValue(emptyPage());
    const input = {
      project_id: 'website',
      status_id: 'open',
      assigned_to_id: 'me',
      custom_fields: { '5': 'urgent' },
      include: ['attachments' as const],
      limit: 10,
    };

    await listIssuesTool.handle(input, toolContext(client));

    expect(client.issues.list).toHaveBeenCalledWith(input);
  });
});

describe('redmine_get_issue', () => {
  it('is read-only', () => {
    expect(getIssueTool.annotations?.readOnlyHint).toBe(true);
  });

  it('forwards id and include to issues.get', async () => {
    const client = fakeRedmineClient();
    client.issues.get.mockResolvedValue(issueSimpleFixture);

    await getIssueTool.handle(
      { issue_id: 42, include: ['journals', 'watchers'] },
      toolContext(client),
    );

    expect(client.issues.get).toHaveBeenCalledWith(42, ['journals', 'watchers']);
  });
});

describe('redmine_create_issue', () => {
  it('is not read-only', () => {
    expect(createIssueTool.annotations?.readOnlyHint).toBe(false);
  });

  it('forwards the input to issues.create and returns the created issue', async () => {
    const client = fakeRedmineClient();
    client.issues.create.mockResolvedValue(issueSimpleFixture);
    const input = { project_id: 1, subject: 'New bug' };

    const result = await createIssueTool.handle(input, toolContext(client));

    expect(client.issues.create).toHaveBeenCalledWith(input);
    expect(result).toBe(issueSimpleFixture);
  });

  it('propagates a RedmineValidationError from the client', async () => {
    const client = fakeRedmineClient();
    client.issues.create.mockRejectedValue(new RedmineValidationError(['Subject cannot be blank']));

    await expect(
      createIssueTool.handle({ project_id: 1, subject: 'x' }, toolContext(client)),
    ).rejects.toBeInstanceOf(RedmineValidationError);
  });
});

describe('redmine_update_issue', () => {
  it('is not read-only', () => {
    expect(updateIssueTool.annotations?.readOnlyHint).toBe(false);
  });

  it('updates then re-fetches and returns the fresh issue (ADR-0011)', async () => {
    const client = fakeRedmineClient();
    client.issues.update.mockResolvedValue(undefined);
    client.issues.get.mockResolvedValue(issueSimpleFixture);

    const result = await updateIssueTool.handle(
      { issue_id: 42, status_id: 2, notes: 'In progress' },
      toolContext(client),
    );

    // The routing id is stripped from the update body.
    expect(client.issues.update).toHaveBeenCalledWith(42, { status_id: 2, notes: 'In progress' });
    // The re-fetch is what the tool returns.
    expect(client.issues.get).toHaveBeenCalledWith(42);
    expect(result).toBe(issueSimpleFixture);

    const updateOrder = client.issues.update.mock.invocationCallOrder[0];
    const getOrder = client.issues.get.mock.invocationCallOrder[0];
    expect(updateOrder).toBeLessThan(getOrder as number);
  });
});

describe('redmine_delete_issue', () => {
  it('is annotated as a destructive, non-idempotent write', () => {
    // A regression guard: copy-pasting a read-only annotation block here would
    // strip the only signal an MCP client can gate a destructive call on.
    expect(deleteIssueTool.annotations?.readOnlyHint).toBe(false);
    expect(deleteIssueTool.annotations?.destructiveHint).toBe(true);
    expect(deleteIssueTool.annotations?.idempotentHint).toBe(false);
  });

  it('forwards the id to issues.delete and returns a confirmation', async () => {
    const client = fakeRedmineClient();
    client.issues.delete.mockResolvedValue(undefined);

    const result = await deleteIssueTool.handle({ issue_id: 42 }, toolContext(client));

    expect(client.issues.delete).toHaveBeenCalledWith(42);
    expect(result).toEqual({ deleted: true, issue_id: 42 });
  });

  it('propagates a RedmineForbiddenError unchanged (the MCP adapter formats it)', async () => {
    const client = fakeRedmineClient();
    client.issues.delete.mockRejectedValue(new RedmineForbiddenError());

    await expect(
      deleteIssueTool.handle({ issue_id: 42 }, toolContext(client)),
    ).rejects.toBeInstanceOf(RedmineForbiddenError);
  });

  it('propagates a RedmineNotFoundError for an already-deleted issue', async () => {
    const client = fakeRedmineClient();
    client.issues.delete.mockRejectedValue(new RedmineNotFoundError());

    // Why `idempotentHint: false`: the repeat call fails rather than no-ops.
    await expect(
      deleteIssueTool.handle({ issue_id: 42 }, toolContext(client)),
    ).rejects.toBeInstanceOf(RedmineNotFoundError);
  });
});

/** A relation as the client returns it: #17 blocks #42. */
const relationFixture = {
  id: 9,
  issue_id: 17,
  issue_to_id: 42,
  relation_type: 'blocks',
  delay: null,
} as const;

describe('redmine_list_issue_relations', () => {
  it('is read-only', () => {
    expect(listIssueRelationsTool.annotations?.readOnlyHint).toBe(true);
  });

  it('list mode forwards the issue id and wraps the relations in an object', async () => {
    const client = fakeRedmineClient();
    client.issueRelations.listForIssue.mockResolvedValue([relationFixture]);

    const result = await listIssueRelationsTool.handle({ issue_id: 17 }, toolContext(client));

    expect(client.issueRelations.listForIssue).toHaveBeenCalledWith(17);
    expect(client.issueRelations.get).not.toHaveBeenCalled();
    // An object, not a bare array: MCP structured content must be a JSON object.
    expect(result).toEqual({ relations: [relationFixture] });
  });

  it('single mode looks the relation up by its own id', async () => {
    const client = fakeRedmineClient();
    client.issueRelations.get.mockResolvedValue(relationFixture);

    const result = await listIssueRelationsTool.handle(
      { issue_relation_id: 9 },
      toolContext(client),
    );

    expect(client.issueRelations.get).toHaveBeenCalledWith(9);
    expect(client.issueRelations.listForIssue).not.toHaveBeenCalled();
    expect(result).toBe(relationFixture);
  });

  it('rejects when neither issue_id nor issue_relation_id is given', async () => {
    const client = fakeRedmineClient();

    await expect(listIssueRelationsTool.handle({}, toolContext(client))).rejects.toThrow(
      /exactly one of issue_id or issue_relation_id/,
    );
    expect(client.issueRelations.listForIssue).not.toHaveBeenCalled();
  });

  it('rejects when both are given', async () => {
    const client = fakeRedmineClient();

    await expect(
      listIssueRelationsTool.handle({ issue_id: 17, issue_relation_id: 9 }, toolContext(client)),
    ).rejects.toThrow(/exactly one of issue_id or issue_relation_id/);
    expect(client.issueRelations.get).not.toHaveBeenCalled();
  });
});

describe('redmine_create_issue_relation', () => {
  it('is a non-destructive, non-idempotent write', () => {
    expect(createIssueRelationTool.annotations?.readOnlyHint).toBe(false);
    expect(createIssueRelationTool.annotations?.destructiveHint).toBe(false);
    expect(createIssueRelationTool.annotations?.idempotentHint).toBe(false);
  });

  it('splits the source id from the relation body and returns the created relation', async () => {
    const client = fakeRedmineClient();
    client.issueRelations.create.mockResolvedValue(relationFixture);

    const result = await createIssueRelationTool.handle(
      { issue_id: 17, issue_to_id: 42, relation_type: 'blocks' },
      toolContext(client),
    );

    expect(client.issueRelations.create).toHaveBeenCalledWith(17, {
      issue_to_id: 42,
      relation_type: 'blocks',
    });
    expect(result).toBe(relationFixture);
  });

  it('accepts delay with a precedes relation', async () => {
    const client = fakeRedmineClient();
    client.issueRelations.create.mockResolvedValue({
      ...relationFixture,
      relation_type: 'precedes',
      delay: 2,
    });

    await createIssueRelationTool.handle(
      { issue_id: 17, issue_to_id: 42, relation_type: 'precedes', delay: 2 },
      toolContext(client),
    );

    expect(client.issueRelations.create).toHaveBeenCalledWith(17, {
      issue_to_id: 42,
      relation_type: 'precedes',
      delay: 2,
    });
  });

  it('rejects delay with a relation type that has no delay semantics', async () => {
    const client = fakeRedmineClient();

    await expect(
      createIssueRelationTool.handle(
        { issue_id: 17, issue_to_id: 42, relation_type: 'blocks', delay: 2 },
        toolContext(client),
      ),
    ).rejects.toThrow(/delay only with relation_type/);
    expect(client.issueRelations.create).not.toHaveBeenCalled();
  });

  it('rejects a relation type outside the enum', () => {
    // The write side is strict on purpose: a typo fails here, not as a remote 422.
    expect(() => createIssueRelationTool.inputSchema.relation_type.parse('blokcs')).toThrow(
      ZodError,
    );
  });

  it('propagates a RedmineValidationError — Redmine judges self/circular/duplicate links', async () => {
    const client = fakeRedmineClient();
    client.issueRelations.create.mockRejectedValue(
      new RedmineValidationError(['Issue cannot be related to itself']),
    );

    await expect(
      createIssueRelationTool.handle(
        { issue_id: 17, issue_to_id: 17, relation_type: 'blocks' },
        toolContext(client),
      ),
    ).rejects.toBeInstanceOf(RedmineValidationError);
  });
});

describe('redmine_delete_issue_relation', () => {
  it('is annotated as a destructive, non-idempotent write', () => {
    // Cheap regression guard: this hint is the only signal a client can gate on.
    expect(deleteIssueRelationTool.annotations?.readOnlyHint).toBe(false);
    expect(deleteIssueRelationTool.annotations?.destructiveHint).toBe(true);
    expect(deleteIssueRelationTool.annotations?.idempotentHint).toBe(false);
  });

  it('forwards the relation id and returns a confirmation', async () => {
    const client = fakeRedmineClient();
    client.issueRelations.delete.mockResolvedValue(undefined);

    const result = await deleteIssueRelationTool.handle(
      { issue_relation_id: 9 },
      toolContext(client),
    );

    expect(client.issueRelations.delete).toHaveBeenCalledWith(9);
    expect(result).toEqual({ deleted: true, issue_relation_id: 9 });
  });

  it('propagates a RedmineForbiddenError unchanged (the MCP adapter formats it)', async () => {
    const client = fakeRedmineClient();
    client.issueRelations.delete.mockRejectedValue(new RedmineForbiddenError());

    await expect(
      deleteIssueRelationTool.handle({ issue_relation_id: 9 }, toolContext(client)),
    ).rejects.toBeInstanceOf(RedmineForbiddenError);
  });
});

describe('redmine_manage_issue_watchers', () => {
  it('is a non-destructive, idempotent write', () => {
    expect(manageIssueWatchersTool.annotations?.readOnlyHint).toBe(false);
    expect(manageIssueWatchersTool.annotations?.destructiveHint).toBe(false);
    expect(manageIssueWatchersTool.annotations?.idempotentHint).toBe(true);
  });

  it('action "add" calls addWatcher and never removeWatcher', async () => {
    const client = fakeRedmineClient();
    client.issues.addWatcher.mockResolvedValue(undefined);

    const result = await manageIssueWatchersTool.handle(
      { issue_id: 42, user_id: 7, action: 'add' },
      toolContext(client),
    );

    expect(client.issues.addWatcher).toHaveBeenCalledWith(42, 7);
    expect(client.issues.removeWatcher).not.toHaveBeenCalled();
    expect(result).toEqual({ issue_id: 42, user_id: 7, action: 'add', ok: true });
  });

  it('action "remove" calls removeWatcher and never addWatcher', async () => {
    const client = fakeRedmineClient();
    client.issues.removeWatcher.mockResolvedValue(undefined);

    const result = await manageIssueWatchersTool.handle(
      { issue_id: 42, user_id: 7, action: 'remove' },
      toolContext(client),
    );

    expect(client.issues.removeWatcher).toHaveBeenCalledWith(42, 7);
    expect(client.issues.addWatcher).not.toHaveBeenCalled();
    expect(result).toEqual({ issue_id: 42, user_id: 7, action: 'remove', ok: true });
  });

  it('rejects an action outside the enum, and a missing one', () => {
    expect(() => manageIssueWatchersTool.inputSchema.action.parse('toggle')).toThrow(ZodError);
    expect(() => manageIssueWatchersTool.inputSchema.action.parse(undefined)).toThrow(ZodError);
  });

  it('propagates a RedmineForbiddenError — the common "Manage watchers" case', async () => {
    const client = fakeRedmineClient();
    client.issues.addWatcher.mockRejectedValue(new RedmineForbiddenError());

    await expect(
      manageIssueWatchersTool.handle(
        { issue_id: 42, user_id: 7, action: 'add' },
        toolContext(client),
      ),
    ).rejects.toBeInstanceOf(RedmineForbiddenError);
  });
});
