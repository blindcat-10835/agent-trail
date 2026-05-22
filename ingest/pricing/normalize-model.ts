const SYNTHETIC_MODEL = '<synthetic>';

function stripProviderPrefix(model: string): string {
  const trimmed = model.trim();
  if (!trimmed) return '';

  const segments = trimmed.split('/').filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1] : trimmed;
}

function normalizeGlmFamily(model: string): string {
  return model.replace(/^glm(?=\d)/, 'glm-');
}

export function normalizeModelName(model: string | null | undefined): string {
  const stripped = stripProviderPrefix(model ?? '');
  if (!stripped) return '';

  const normalized = stripped
    .toLowerCase()
    .replace(/_/g, '-');

  if (!normalized || normalized === SYNTHETIC_MODEL) return '';
  return normalizeGlmFamily(normalized);
}

export function getCanonicalModelKey(model: string | null | undefined): string | null {
  const normalized = normalizeModelName(model);
  return normalized || null;
}

export function getDisplayModelName(model: string | null | undefined): string | null {
  const canonical = getCanonicalModelKey(model);
  if (!canonical) return null;

  if (canonical.startsWith('glm-')) {
    return canonical.replace(/^glm-/, 'glm');
  }

  return canonical;
}
