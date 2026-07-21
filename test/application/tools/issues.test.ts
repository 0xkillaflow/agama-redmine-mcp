import { describe, it, expect } from 'vitest';
import { listIssuesTool } from '../../../src/application/tools/issues/list-issues.tool.js';
import { getIssueTool } from '../../../src/application/tools/issues/get-issue.tool.js';
import { createIssueTool } from '../../../src/application/tools/issues/create-issue.tool.js';
import { updateIssueTool } from '../../../src/application/tools/issues/update-issue.tool.js';
import { RedmineValidationError } from '../../../src/domain/errors/index.js';
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
