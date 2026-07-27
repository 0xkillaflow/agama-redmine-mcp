import { describe, it, expect } from 'vitest';
import { createReferenceDataResource } from '../../../../src/adapters/redmine/resources/reference-data.js';
import { RedmineTransportError } from '../../../../src/domain/errors/index.js';
import type { ReferenceDataKind } from '../../../../src/domain/models/index.js';
import { mockHttp } from './support.js';

/** A representative item for each kind, matching that kind's schema. */
const items: Readonly<Record<ReferenceDataKind, unknown>> = {
  statuses: { id: 1, name: 'New', is_closed: false },
  trackers: { id: 2, name: 'Bug', default_status: { id: 1, name: 'New' }, description: null },
  priorities: { id: 4, name: 'Normal', is_default: true, active: true },
  activities: { id: 8, name: 'Development', is_default: false, active: true },
  document_categories: { id: 1, name: 'User documentation', is_default: false, active: true },
};

/**
 * The path and envelope key each kind maps to. The keys deliberately differ from
 * the kinds (`priorities` → `issue_priorities`), which is exactly the mismatch a
 * copy-paste error would break — so every kind is asserted.
 */
const cases: ReadonlyArray<[ReferenceDataKind, string, string]> = [
  ['statuses', '/issue_statuses.json', 'issue_statuses'],
  ['trackers', '/trackers.json', 'trackers'],
  ['priorities', '/enumerations/issue_priorities.json', 'issue_priorities'],
  ['activities', '/enumerations/time_entry_activities.json', 'time_entry_activities'],
  ['document_categories', '/enumerations/document_categories.json', 'document_categories'],
];

describe('createReferenceDataResource', () => {
  it.each(cases)('%s hits %s and unwraps the "%s" envelope', async (kind, path, key) => {
    const { http, get } = mockHttp();
    get.mockResolvedValue({ [key]: [items[kind]] });
    const referenceData = createReferenceDataResource(http);

    const result = await referenceData.list(kind);

    // No query string: these endpoints take no parameters.
    expect(get).toHaveBeenCalledWith(path);
    expect(result).toEqual({ kind, items: [items[kind]] });
  });

  it('parses a tracker carrying the Redmine 5.0+ enabled_standard_fields', async () => {
    const { http, get } = mockHttp();
    const tracker = { id: 2, name: 'Bug', enabled_standard_fields: ['assigned_to_id'] };
    get.mockResolvedValue({ trackers: [tracker] });
    const referenceData = createReferenceDataResource(http);

    const result = await referenceData.list('trackers');

    expect(result.items).toEqual([tracker]);
  });

  it('turns a schema-mismatched body into a transport error', async () => {
    const { http, get } = mockHttp();
    get.mockResolvedValue({ issue_statuses: [{ id: 'nope' }] });
    const referenceData = createReferenceDataResource(http);

    await expect(referenceData.list('statuses')).rejects.toBeInstanceOf(RedmineTransportError);
  });

  it('turns a missing envelope key into a transport error', async () => {
    const { http, get } = mockHttp();
    // The wrong key is what a kind → key mix-up would look like on the wire.
    get.mockResolvedValue({ priorities: [] });
    const referenceData = createReferenceDataResource(http);

    await expect(referenceData.list('priorities')).rejects.toBeInstanceOf(RedmineTransportError);
  });
});
