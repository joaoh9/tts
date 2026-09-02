const MAX_SLUG = 48;

export function slugify(text, fallback = "take") {
  const ascii = String(text ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG)
    .replace(/-+$/g, "");
  return ascii || fallback;
}

export function uniqueSlug(existing, base) {
  const names = new Set(existing);
  if (!names.has(base)) return base;
  for (let n = 2; n < 10_000; n += 1) {
    const candidate = `${base}-${n}`;
    if (!names.has(candidate)) return candidate;
  }
  throw new Error(`Could not allocate a unique slug from "${base}"`);
}
