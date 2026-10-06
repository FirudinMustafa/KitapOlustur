// Row ids in this app are Postgres uuid columns. Querying one with a
// malformed string makes Postgres throw ("invalid input syntax for type
// uuid"), which surfaced as a 500 for any hand-typed/garbled URL - callers
// check this first and answer 404 instead.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}
