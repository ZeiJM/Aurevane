import { useSyncExternalStore } from 'react'
// Fixture image rendering uses the same assets without requiring a Next image server.
export default function Image(props) {
  const imageProps = { ...props }
  for (const key of ['unoptimized', 'priority', 'fill', 'loader']) delete imageProps[key]
  // eslint-disable-next-line @next/next/no-img-element -- mounted component fixture
  return <img {...imageProps} alt={props.alt ?? ''} />
}
for (const method of ['pushState', 'replaceState']) {
  const original = history[method].bind(history)
  history[method] = (...args) => {
    original(...args)
    dispatchEvent(new PopStateEvent('popstate'))
  }
}
const subscribe = (cb) => {
  window.addEventListener('popstate', cb)
  return () => window.removeEventListener('popstate', cb)
}
const navigate = (url) => {
  history.pushState(null, '', url)
  dispatchEvent(new PopStateEvent('popstate'))
}
export const useRouter = () => ({ refresh() {}, push: navigate, replace: navigate })
export const usePathname = () => location.pathname
export const useSearchParams = () =>
  new URLSearchParams(
    useSyncExternalStore(
      subscribe,
      () => location.search,
      () => '',
    ),
  )
