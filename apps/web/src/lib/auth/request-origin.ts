const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]'])

function parseHost(value: string, protocol: string): URL | null {
  if (/[\s\\/@?#]/.test(value)) return null
  try {
    const parsed = new URL(`${protocol}//${value}`)
    if (parsed.host !== value.toLowerCase() || !parsed.hostname) return null
    return parsed
  } catch {
    return null
  }
}

/** Next's internal request URL can use localhost even when the browser uses another host. */
export function getAuthRequestOrigin(
  request: Request,
  trustedHosts: readonly string[] = [
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
  ].filter((value): value is string => Boolean(value)),
): string | null {
  const requestUrl = new URL(request.url)
  if (requestUrl.protocol !== 'http:' && requestUrl.protocol !== 'https:') return null
  const host = request.headers.get('host')
  if (!host) return requestUrl.origin
  const incoming = parseHost(host, requestUrl.protocol)
  if (!incoming) return null
  if (incoming.host === requestUrl.host) return incoming.origin
  const sameLocalPort =
    loopbackHosts.has(requestUrl.hostname) &&
    loopbackHosts.has(incoming.hostname) &&
    incoming.port === requestUrl.port
  if (
    sameLocalPort ||
    trustedHosts.some((trusted) => parseHost(trusted, requestUrl.protocol)?.host === incoming.host)
  ) {
    return incoming.origin
  }
  return null
}
