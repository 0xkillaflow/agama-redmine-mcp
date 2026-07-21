/**
 * The assembled set of tools the server exposes.
 *
 * Each tool area contributes its {@link ToolDefinition}s to this array; the
 * composition root feeds it into {@link createToolRegistry}. The list is empty
 * until the individual tools land, and every new tool is registered by adding it
 * here.
 */

import type { AnyToolDefinition } from '../tool-registry.js';
import { listIssuesTool } from './issues/list-issues.tool.js';
import { getIssueTool } from './issues/get-issue.tool.js';
import { createIssueTool } from './issues/create-issue.tool.js';
import { updateIssueTool } from './issues/update-issue.tool.js';
import { listProjectsTool } from './projects/list-projects.tool.js';
import { getProjectTool } from './projects/get-project.tool.js';
import { listTimeEntriesTool } from './time-entries/list-time-entries.tool.js';
import { createTimeEntryTool } from './time-entries/create-time-entry.tool.js';
import { getCurrentUserTool } from './users/get-current-user.tool.js';
import { searchTool } from './search/search.tool.js';

/** Every tool the server exposes, in catalog order. */
export const tools: AnyToolDefinition[] = [
  listIssuesTool,
  getIssueTool,
  createIssueTool,
  updateIssueTool,
  searchTool,
  listProjectsTool,
  getProjectTool,
  listTimeEntriesTool,
  createTimeEntryTool,
  getCurrentUserTool,
];
