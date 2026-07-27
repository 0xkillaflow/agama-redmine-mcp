/**
 * Reference-data resource client: the `ReferenceDataResource` port backed by the
 * Redmine HTTP requester.
 *
 * All five collections are parameterless GETs whose only differences are the
 * path, the envelope key, and the item schema — so they live in one lookup table
 * rather than five near-identical methods. The keys deliberately do **not**
 * mirror the `kind` values (`priorities` is served under `issue_priorities`);
 * the table is the single place that mapping is written down.
 *
 * The responses carry no `total_count`/`offset`/`limit`, so they are parsed as a
 * plain array — wrapping them in a synthetic page would misreport the wire shape.
 */

import { z } from 'zod';
import {
  EnumerationSchema,
  IssueStatusRefSchema,
  TrackerSchema,
  type ReferenceData,
  type ReferenceDataKind,
} from '../../../domain/models/index.js';
import type { ReferenceDataResource } from '../../../domain/ports/index.js';
import type { HttpRequester } from '../http-requester.js';
import { parseEnvelope } from './parse.js';

/** How one reference kind is fetched and parsed. */
interface ReferenceEndpoint {
  /** Redmine path serving the collection. */
  readonly path: string;
  /** The response property holding the array (not always equal to the kind). */
  readonly key: string;
  /** Schema for a single item of that array. */
  readonly schema: z.ZodTypeAny;
}

/** `kind` → endpoint, key, and item schema. Adding a kind is one entry here. */
const ENDPOINTS: Readonly<Record<ReferenceDataKind, ReferenceEndpoint>> = {
  statuses: {
    path: '/issue_statuses.json',
    key: 'issue_statuses',
    schema: IssueStatusRefSchema,
  },
  trackers: {
    path: '/trackers.json',
    key: 'trackers',
    schema: TrackerSchema,
  },
  priorities: {
    path: '/enumerations/issue_priorities.json',
    key: 'issue_priorities',
    schema: EnumerationSchema,
  },
  activities: {
    path: '/enumerations/time_entry_activities.json',
    key: 'time_entry_activities',
    schema: EnumerationSchema,
  },
  document_categories: {
    path: '/enumerations/document_categories.json',
    key: 'document_categories',
    schema: EnumerationSchema,
  },
};

/** Build the `ReferenceDataResource` bound to the given requester. */
export function createReferenceDataResource(http: HttpRequester): ReferenceDataResource {
  return {
    async list(kind: ReferenceDataKind): Promise<ReferenceData> {
      const { path, key, schema } = ENDPOINTS[kind];
      const body = await http.get(path);
      const items: unknown[] = parseEnvelope(key, z.array(schema), body, `list ${kind}`);

      // The table pairs each kind with its own schema, so the parsed items always
      // match the union arm `kind` selects. TypeScript cannot follow that
      // correlation through the table lookup, so it is asserted once, here.
      return { kind, items } as ReferenceData;
    },
  };
}
