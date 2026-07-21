/**
 * Redmine query/request serialization.
 *
 * The single place that encodes Redmine's filter-grammar quirks, so resource
 * clients stay declarative — they hand over a plain params object and get back a
 * ready-to-use query string. Keep this file well-commented and update it here
 * whenever Redmine changes its filter grammar.
 *
 * Conventions:
 *  - Arrays are `explode:false` → comma-joined into a single value
 *    (`status_id: [1,2]` → `status_id=1,2`). `include` follows the same rule.
 *  - Custom-field filters use `cf_<id>` keys (the `custom_fields` map expands).
 *  - Boolean flags (search flags, `is_public`) are omitted when false and sent
 *    as `1` when true.
 *  - Dates carry operator prefixes (`>=2024-01-01`, `><a|b`) and pass through
 *    unchanged (they are URL-encoded, not interpreted).
 *  - `undefined`/`null` are skipped; `0` and a meaningful empty string are kept.
 *
 * All values are URL-encoded via `URLSearchParams`.
 */

/** The wire value used for a truthy Redmine boolean flag. */
const FLAG_TRUE = '1';

/** The reserved params key whose map expands into `cf_<id>` filter keys. */
const CUSTOM_FIELDS_KEY = 'custom_fields';

/**
 * A single query value a resource client may pass. `custom_fields` carries a
 * `Record<string,string>` (expanded to `cf_<id>` keys); every other field is a
 * scalar or an array of scalars.
 */
export type QueryValue =
  | string
  | number
  | boolean
  | ReadonlyArray<string | number>
  | Readonly<Record<string, string>>
  | null
  | undefined;

/** A params object accepted by {@link toQuery}. */
export type QueryParams = Readonly<Record<string, QueryValue>>;

/** Comma-join an array into Redmine's `explode:false` single-value form. */
export function csv(values: ReadonlyArray<string | number>): string {
  return values.join(',');
}

/**
 * Encode a Redmine boolean flag: `1` when true, `undefined` (omitted) when
 * false. Callers append the result only when it is defined.
 */
export function flag(value: boolean): typeof FLAG_TRUE | undefined {
  return value ? FLAG_TRUE : undefined;
}

/**
 * Expand a custom-field filter map into `cf_<id>` keys
 * (`{ '2': 'x' }` → `{ cf_2: 'x' }`), ready to merge into a params object.
 */
export function cfParams(map: Readonly<Record<string, string>>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, value] of Object.entries(map)) {
    out[`cf_${id}`] = value;
  }
  return out;
}

/** Narrow a value to a plain (non-array) object — a custom-field map. */
function isRecord(value: unknown): value is Readonly<Record<string, string>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Normalize a free-text filter value to Redmine's "contains" (`~`) operator, so a
 * bare value matches as a substring — the documented behavior for text filters
 * like `subject`. Redmine's simplified `field=value` form otherwise treats a bare
 * value as an *exact* match and only honors `~` inline (verified: `=`/`!` are taken
 * literally). A value already starting with `~` is a caller-supplied contains
 * filter and is left unchanged; an empty value is left untouched.
 */
export function textContains(value: string): string {
  if (value.length === 0 || value.startsWith('~')) return value;
  return `~${value}`;
}

/**
 * Serialize a params object into a Redmine query string, applying the
 * conventions documented above. Returns an empty string for empty params.
 */
export function toQuery(params: QueryParams): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    // Skip absent values; `0` and empty strings are handled by later branches.
    if (value === undefined || value === null) continue;

    // Custom fields expand into one `cf_<id>` entry each.
    if (key === CUSTOM_FIELDS_KEY && isRecord(value)) {
      for (const [cfKey, cfValue] of Object.entries(cfParams(value))) {
        search.set(cfKey, cfValue);
      }
      continue;
    }

    // Booleans: omit when false, `1` when true.
    if (typeof value === 'boolean') {
      const encoded = flag(value);
      if (encoded !== undefined) search.set(key, encoded);
      continue;
    }

    // Arrays: comma-join; skip empty arrays rather than emit a bare `key=`.
    if (Array.isArray(value)) {
      if (value.length > 0) search.set(key, csv(value));
      continue;
    }

    // Scalars (string | number): kept as-is, including `0` and empty strings.
    // Operator-prefixed date strings pass through here and are URL-encoded.
    search.set(key, String(value));
  }

  return search.toString();
}
