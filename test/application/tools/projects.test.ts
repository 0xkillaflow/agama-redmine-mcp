import { describe, it, expect } from 'vitest';
import { listProjectsTool } from '../../../src/application/tools/projects/list-projects.tool.js';
import { getProjectTool } from '../../../src/application/tools/projects/get-project.tool.js';
import { projectSimpleFixture } from '../../adapters/redmine/resources/support.js';
import { fakeRedmineClient, toolContext, emptyPage } from './support.js';

describe('redmine_list_projects', () => {
  it('is read-only', () => {
    expect(listProjectsTool.annotations?.readOnlyHint).toBe(true);
  });

  it('maps the friendly status enum to Redmine integer codes', async () => {
    const client = fakeRedmineClient();
    client.projects.list.mockResolvedValue(emptyPage());

    await listProjectsTool.handle({ status: 'archived', name: 'web' }, toolContext(client));

    expect(client.projects.list).toHaveBeenCalledWith({ status: 9, name: 'web' });
  });

  it('omits status when not provided and passes other filters through', async () => {
    const client = fakeRedmineClient();
    client.projects.list.mockResolvedValue(emptyPage());

    await listProjectsTool.handle(
      { include: ['trackers', 'time_entry_activities'], limit: 5 },
      toolContext(client),
    );

    expect(client.projects.list).toHaveBeenCalledWith({
      include: ['trackers', 'time_entry_activities'],
      limit: 5,
    });
  });
});

describe('redmine_get_project', () => {
  it('is read-only', () => {
    expect(getProjectTool.annotations?.readOnlyHint).toBe(true);
  });

  it('accepts a numeric id', async () => {
    const client = fakeRedmineClient();
    client.projects.get.mockResolvedValue(projectSimpleFixture);

    await getProjectTool.handle({ project_id: 1, include: ['trackers'] }, toolContext(client));

    expect(client.projects.get).toHaveBeenCalledWith(1, ['trackers']);
  });

  it('accepts an identifier slug', async () => {
    const client = fakeRedmineClient();
    client.projects.get.mockResolvedValue(projectSimpleFixture);

    await getProjectTool.handle({ project_id: 'website' }, toolContext(client));

    expect(client.projects.get).toHaveBeenCalledWith('website', undefined);
  });
});
