import { z } from 'zod';

/**
 * Shared Zod schemas and inferred types reused across every Redmine resource.
 * Resource models (issues, projects, …) build on these so
 * they stay small and consistent.
 *
 * Naming convention:
 *  - `XSchema` is the Zod schema (the runtime validator).
 *  - `X` is the inferred TypeScript type: `type X = z.infer<typeof XSchema>`.
 *
 * Optionality convention (Redmine is loose about this):
 *  - `.nullable()` where Redmine returns an explicit `null`.
 *  - `.optional()` where a field may be absent (typically gated by `include`).
 */

/** `{ id, name }` — Redmine's ubiquitous reference object (core `id_name`). */
export const IdNameSchema = z.object({
  id: z.number(),
  name: z.string(),
});
export type IdName = z.infer<typeof IdNameSchema>;

/** A status reference carrying its closed flag (core `issue_status`). */
export const IssueStatusRefSchema = z.object({
  id: z.number(),
  name: z.string(),
  is_closed: z.boolean(),
});
export type IssueStatusRef = z.infer<typeof IssueStatusRefSchema>;

/**
 * A custom field value as returned by Redmine (core `custom_field_value`).
 *
 * The `value` shape is deliberately loose: Redmine returns a scalar `string` for
 * single-valued fields, a `string[]` for multi-valued ones, and `null` when a
 * field is present but unset. `value` may also be absent entirely.
 */
export const CustomFieldValueSchema = z.object({
  id: z.number(),
  name: z.string(),
  multiple: z.boolean().optional(),
  value: z
    .union([z.string(), z.array(z.string())])
    .nullable()
    .optional(),
});
export type CustomFieldValue = z.infer<typeof CustomFieldValueSchema>;

/**
 * A custom field value as *sent* to Redmine on write (core `custom_fields`
 * array items). Only the field `id` and its `value` are provided; `value`
 * mirrors the read shape (scalar for single-valued fields, array for
 * multi-valued ones). Redmine also accepts a `custom_field_values` map form,
 * but tools use this array form.
 */
export const CustomFieldWriteSchema = z.object({
  id: z.number(),
  value: z.union([z.string(), z.array(z.string())]),
});
export type CustomFieldWrite = z.infer<typeof CustomFieldWriteSchema>;

/** An attachment reference (core `attachment`). */
export const AttachmentRefSchema = z.object({
  id: z.number(),
  filename: z.string(),
  filesize: z.number(),
  content_type: z.string(),
  description: z.string(),
  content_url: z.string(),
  // Present only for previewable content (images, …).
  thumbnail_url: z.string().optional(),
  author: IdNameSchema,
  created_on: z.string(),
});
export type AttachmentRef = z.infer<typeof AttachmentRefSchema>;

/**
 * Redmine's error envelope (core `errors`), returned on 422 responses. Consumed
 * by the HTTP → domain error mapper.
 */
export const RedmineErrorsBodySchema = z.object({
  errors: z.array(z.string()),
});
export type RedmineErrorsBody = z.infer<typeof RedmineErrorsBodySchema>;

/**
 * A normalized, resource-agnostic collection page. Redmine names the array after
 * the resource (`issues`, `projects`, …); we normalize it to `items` so callers
 * are uniform. See {@link paginated}.
 */
export interface Paginated<T> {
  readonly items: readonly T[];
  readonly totalCount: number;
  readonly offset: number;
  readonly limit: number;
}

/**
 * Build a schema that parses a Redmine list response
 * `{ <key>: T[], total_count, offset, limit }` and normalizes it into a
 * {@link Paginated | Paginated<T>}.
 *
 * `total_count`, `offset`, and `limit` are treated as optional — Redmine omits
 * them on some small responses — and defaulted sensibly: `totalCount` falls back
 * to the number of returned items, `offset` to `0`, and `limit` to the page size.
 *
 * @param key - The resource-named array key in the response (e.g. `'issues'`).
 * @param itemSchema - Schema for a single element of the array.
 */
export function paginated<ItemSchema extends z.ZodTypeAny>(
  key: string,
  itemSchema: ItemSchema,
): z.ZodType<Paginated<z.infer<ItemSchema>>, z.ZodTypeDef, unknown> {
  const envelope = z.object({
    [key]: z.array(itemSchema),
    total_count: z.number().int().nonnegative().optional(),
    offset: z.number().int().nonnegative().optional(),
    limit: z.number().int().nonnegative().optional(),
  });

  return envelope.transform((raw): Paginated<z.infer<ItemSchema>> => {
    const record = raw as {
      readonly total_count?: number;
      readonly offset?: number;
      readonly limit?: number;
    } & Record<string, unknown>;
    const items = record[key] as z.infer<ItemSchema>[];

    return {
      items,
      totalCount: record.total_count ?? items.length,
      offset: record.offset ?? 0,
      limit: record.limit ?? items.length,
    };
  });
}

/** An `include` parameter value: the set of expansions requested for a resource. */
export type Include<Value extends string> = readonly Value[];

/**
 * Build a schema for a resource's `include` parameter — an array of the given
 * literal expansion names. Each resource model supplies its own allowed values;
 * the comma-join into Redmine's `include=a,b` wire form happens in the request
 * builder, not here.
 *
 * @param values - The non-empty tuple of valid include names for the resource.
 */
export function includeSchema<const Values extends readonly [string, ...string[]]>(
  values: Values,
): z.ZodArray<z.ZodEnum<[Values[number], ...Values[number][]]>> {
  return z.array(z.enum(values as unknown as [Values[number], ...Values[number][]]));
}
