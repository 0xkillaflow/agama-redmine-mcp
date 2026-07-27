/**
 * `redmine_list_reference_data` — the instance-wide dropdown options.
 *
 * Read-only tool over {@link RedmineClient.referenceData.list}. One `kind`
 * parameter covers five near-identical enumeration endpoints, which keeps the
 * catalog intent-shaped ("give me the legal values") instead of spending five
 * entries on the same intent. Every write tool takes ids, so this is what turns
 * "mark it Resolved" or "log it as Development" into a number.
 */

import { ReferenceDataKindSchema } from '../../../domain/models/index.js';
import { defineTool } from '../../tool-definition.js';

/** Agent-facing input shape for `redmine_list_reference_data`. */
const inputShape = {
  kind: ReferenceDataKindSchema.describe(
    'Which reference collection to return: ' +
      '"statuses" — issue statuses, for `status_id` on create/update issue; ' +
      '"trackers" — issue types (Bug, Feature, …), for `tracker_id`; ' +
      '"priorities" — issue priorities, for `priority_id`; ' +
      '"activities" — time-entry activities (Development, Design, …), for `activity_id`; ' +
      '"document_categories" — document categories (rarely needed).',
  ),
};

export const listReferenceDataTool = defineTool({
  name: 'redmine_list_reference_data',
  title: 'List reference data',
  description:
    'Look up the legal values behind the id parameters the write tools require — issue statuses, ' +
    'trackers, priorities, time-entry activities, or document categories — selected by `kind`. ' +
    'Call this before creating or updating an issue or time entry instead of guessing an id. ' +
    'These are the global, instance-wide lists; for what a single project actually has enabled, ' +
    'use `redmine_get_project` with `include` ("trackers", "issue_categories", ' +
    '"time_entry_activities").',
  inputSchema: inputShape,
  annotations: { readOnlyHint: true, openWorldHint: true },
  handle: async (input, { redmine }) => redmine.referenceData.list(input.kind),
});
