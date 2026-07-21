import { describe, it, expect } from 'vitest';
import { createProjectsResource } from '../../../../src/adapters/redmine/resources/projects.js';
import { RedmineTransportError } from '../../../../src/domain/errors/index.js';
import { listEnvelope, mockHttp, projectSimpleFixture } from './support.js';

describe('createProjectsResource', () => {
  it('list hits GET /projects.json and normalizes the page', async () => {
    const { http, get } = mockHttp();
    get.mockResolvedValue(listEnvelope('projects', [projectSimpleFixture]));
    const projects = createProjectsResource(http);

    const page = await projects.list({ status: 1 });

    expect(get).toHaveBeenCalledWith('/projects.json', 'status=1');
    expect(page.items[0]?.identifier).toBe('website');
  });

  it('list preserves include-expanded associations on each item', async () => {
    // Redmine expands `include` on the collection endpoint too; the parser must
    // carry those fields through instead of silently dropping them (BUGS #6).
    const { http, get } = mockHttp();
    get.mockResolvedValue(
      listEnvelope('projects', [
        {
          ...projectSimpleFixture,
          trackers: [
            { id: 1, name: 'Bug' },
            { id: 2, name: 'Feature' },
          ],
          issue_categories: [],
        },
      ]),
    );
    const projects = createProjectsResource(http);

    const page = await projects.list({ include: ['trackers', 'issue_categories'] });

    expect(get).toHaveBeenCalledWith('/projects.json', 'include=trackers%2Cissue_categories');
    expect(page.items[0]?.trackers).toEqual([
      { id: 1, name: 'Bug' },
      { id: 2, name: 'Feature' },
    ]);
    expect(page.items[0]?.issue_categories).toEqual([]);
  });

  it('get resolves a numeric id in the path', async () => {
    const { http, get } = mockHttp();
    get.mockResolvedValue({ project: projectSimpleFixture });
    const projects = createProjectsResource(http);

    await projects.get(42, ['trackers']);

    expect(get).toHaveBeenCalledWith('/projects/42.json', 'include=trackers');
  });

  it('get resolves an identifier slug in the path', async () => {
    const { http, get } = mockHttp();
    get.mockResolvedValue({ project: projectSimpleFixture });
    const projects = createProjectsResource(http);

    const project = await projects.get('website');

    expect(get).toHaveBeenCalledWith('/projects/website.json', '');
    expect(project.id).toBe(1);
    // Raw status integer is preserved (no human labelling in the client).
    expect(project.status).toBe(1);
  });

  it('turns a schema-mismatched body into a transport error', async () => {
    const { http, get } = mockHttp();
    get.mockResolvedValue({ project: { id: 'nope' } });
    const projects = createProjectsResource(http);

    await expect(projects.get(1)).rejects.toBeInstanceOf(RedmineTransportError);
  });
});
