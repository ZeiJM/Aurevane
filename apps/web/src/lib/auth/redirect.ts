export function getSafeInternalRedirect(value: string | null, fallback = '/'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return fallback
  }

  return value
}
