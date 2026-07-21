/**
 * Projects resource client: the `ProjectsResource` port
 * backed by the Redmine HTTP requester.
 *
 * `get` accepts either a numeric id or an identifier slug — Redmine resolves
 * both on `/projects/{ref}.json`, so the reference is passed through unchanged as
 * a path segment. The raw `status` integer is preserved; any human labelling is
 * a tool-layer concern.
 */

import {
  ProjectSchema,
  ProjectSimpleSchema,
  paginated,
  type ListProjectsParams,
  type Paginated,
  type Project,
  type ProjectInclude,
  type ProjectRef,
  type ProjectSimple,
} from '../../../domain/models/index.js';
import type { ProjectsResource } from '../../../domain/ports/index.js';
import type { HttpRequester } from '../http-requester.js';
import { toQuery } from '../request-builder.js';
import { parseBody, parseEnvelope } from './parse.js';

/** Build the `ProjectsResource` bound to the given requester. */
export function createProjectsResource(http: HttpRequester): ProjectsResource {
  return {
    async list(params: ListProjectsParams): Promise<Paginated<ProjectSimple>> {
      const body = await http.get('/projects.json', toQuery(params));
      return parseBody(paginated('projects', ProjectSimpleSchema), body, 'list projects');
    },

    async get(ref: ProjectRef, include?: ProjectInclude[]): Promise<Project> {
      const body = await http.get(`/projects/${ref}.json`, toQuery({ include }));
      return parseEnvelope('project', ProjectSchema, body, 'get project');
    },
  };
}
