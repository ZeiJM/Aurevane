export function getSafeInternalRedirect(value: string | null, fallback = '/'): string {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    /[\\\u0000-\u0020\u007f]/.test(value)
  ) {
    return fallback
  }

  return value
}
