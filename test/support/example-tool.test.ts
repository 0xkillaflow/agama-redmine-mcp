import { describe, it, expect } from 'vitest';
import { RedmineNotFoundError } from '../../src/domain/errors/index.js';
import type { ToolContext } from '../../src/application/tool-definition.js';
import { getIssueTool } from '../../src/application/tools/issues/get-issue.tool.js';
import { fakeRedmineClient } from './fake-redmine-client.js';
import { silentLogger } from './silent-logger.js';

/**
 * Template: a tool handler test using the {@link fakeRedmineClient}. It exercises
 * a handler in isolation (no SDK, no HTTP), asserts the fake recorded the call it
 * mapped the input to, and demonstrates programming an error response. Copy this
 * shape for new tool tests.
 */
describe('example tool test (get-issue over the fake client)', () => {
  it('maps input to the client call and returns its result', async () => {
    // Arrange
    const redmine = fakeRedmineClient();
    const ctx: ToolContext = { redmine, logger: silentLogger() };

    // Act
    const issue = await getIssueTool.handle({ issue_id: 42, include: ['journals'] }, ctx);

    // Assert — the fake recorded the mapped call, and returned its fixture.
    expect(redmine.issues.get.calls).toHaveLength(1);
    expect(redmine.issues.get.calls[0]).toEqual([42, ['journals']]);
    expect(issue.id).toBe(42);
  });

  it('propagates a programmed domain error', async () => {
    // Arrange
    const redmine = fakeRedmineClient();
    redmine.issues.get.reject(new RedmineNotFoundError());
    const ctx: ToolContext = { redmine, logger: silentLogger() };

    // Act / Assert
    await expect(getIssueTool.handle({ issue_id: 999 }, ctx)).rejects.toBeInstanceOf(
      RedmineNotFoundError,
    );
  });
});
