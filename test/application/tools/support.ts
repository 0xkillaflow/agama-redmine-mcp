import { vi } from 'vitest';
import type { RedmineClient } from '../../../src/domain/ports/index.js';
import type { ToolContext } from '../../../src/application/tool-definition.js';
import type { Logger } from '../../../src/domain/ports/index.js';

/**
 * A hand-written {@link RedmineClient} fake for tool unit tests: every resource
 * method is a `vi.fn` spy so tests can assert input→call mapping and stub return
 * values. Handlers under test see only this fake — no HTTP, no SDK.
 */
export interface FakeRedmineClient extends RedmineClient {
  readonly issues: {
    list: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    addWatcher: ReturnType<typeof vi.fn>;
    removeWatcher: ReturnType<typeof vi.fn>;
  };
  readonly issueRelations: {
    listForIssue: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  readonly projects: {
    list: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
  };
  readonly timeEntries: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  readonly users: {
    getCurrent: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
  };
  readonly search: { search: ReturnType<typeof vi.fn> };
  readonly referenceData: { list: ReturnType<typeof vi.fn> };
  readonly attachments: {
    upload: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    download: ReturnType<typeof vi.fn>;
  };
}

/** Build a fresh {@link FakeRedmineClient}; every method resolves `undefined`. */
export function fakeRedmineClient(): FakeRedmineClient {
  return {
    issues: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      addWatcher: vi.fn(),
      removeWatcher: vi.fn(),
    },
    issueRelations: { listForIssue: vi.fn(), get: vi.fn(), create: vi.fn(), delete: vi.fn() },
    projects: { list: vi.fn(), get: vi.fn() },
    timeEntries: { list: vi.fn(), create: vi.fn() },
    users: { getCurrent: vi.fn(), list: vi.fn() },
    search: { search: vi.fn() },
    referenceData: { list: vi.fn() },
    attachments: { upload: vi.fn(), get: vi.fn(), download: vi.fn() },
  };
}

/** A no-op {@link Logger} whose `child` returns itself. */
export function silentLogger(): Logger {
  const logger: Logger = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    child: () => logger,
  };
  return logger;
}

/**
 * Wrap a fake client into a {@link ToolContext} with a silent logger.
 *
 * `allowedDirectories` defaults to empty — the production fail-closed default —
 * so a handler that touches the filesystem must be handed roots explicitly.
 */
export function toolContext(
  redmine: RedmineClient,
  allowedDirectories: readonly string[] = [],
): ToolContext {
  return { redmine, logger: silentLogger(), allowedDirectories };
}

/** An empty paginated page, useful as a default list return. */
export function emptyPage<T>(): {
  items: readonly T[];
  totalCount: number;
  offset: number;
  limit: number;
} {
  return { items: [], totalCount: 0, offset: 0, limit: 25 };
}
