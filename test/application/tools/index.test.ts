import { describe, it, expect } from 'vitest';
import { tools } from '../../../src/application/tools/index.js';
import { createToolRegistry } from '../../../src/application/tool-registry.js';

describe('tools catalog', () => {
  it('exposes exactly the 10 initial tools with unique names', () => {
    const names = tools.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'redmine_list_issues',
        'redmine_get_issue',
        'redmine_create_issue',
        'redmine_update_issue',
        'redmine_search',
        'redmine_list_projects',
        'redmine_get_project',
        'redmine_list_time_entries',
        'redmine_create_time_entry',
        'redmine_get_current_user',
      ]),
    );
    expect(names).toHaveLength(10);
    // The registry rejects duplicates, so this also guards against double-registration.
    expect(new Set(names).size).toBe(names.length);
    expect(() => createToolRegistry(tools)).not.toThrow();
  });
});
