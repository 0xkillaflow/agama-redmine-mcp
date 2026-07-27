import { describe, it, expect } from 'vitest';
import { tools } from '../../../src/application/tools/index.js';
import { createToolRegistry } from '../../../src/application/tool-registry.js';

describe('tools catalog', () => {
  it('exposes exactly the 19 registered tools with unique names', () => {
    const names = tools.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'redmine_list_issues',
        'redmine_get_issue',
        'redmine_create_issue',
        'redmine_update_issue',
        'redmine_delete_issue',
        'redmine_manage_issue_watchers',
        'redmine_list_issue_relations',
        'redmine_create_issue_relation',
        'redmine_delete_issue_relation',
        'redmine_search',
        'redmine_list_projects',
        'redmine_get_project',
        'redmine_list_time_entries',
        'redmine_create_time_entry',
        'redmine_get_current_user',
        'redmine_list_users',
        'redmine_list_reference_data',
        'redmine_upload_attachment',
        'redmine_download_attachment',
      ]),
    );
    expect(names).toHaveLength(19);
    // The registry rejects duplicates, so this also guards against double-registration.
    expect(new Set(names).size).toBe(names.length);
    expect(() => createToolRegistry(tools)).not.toThrow();
  });
});
