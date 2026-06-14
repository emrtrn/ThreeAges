export function uniqueEditorId(
  prefix: string,
  existing: ReadonlySet<string>,
  randomRange = 1_000_000,
): string {
  let id = "";
  do {
    id = `${prefix}-${Date.now().toString(36)}-${Math.floor(
      Math.random() * randomRange,
    ).toString(36)}`;
  } while (existing.has(id));
  return id;
}
