import React from 'react'

// Isolated fixtures use native links. Navigation timing is tested in the Next app.
export function useLinkStatus() {
  return { pending: false }
}

export default function Link(props) {
  const anchor = { ...props }
  delete anchor.prefetch
  delete anchor.onNavigate
  return <a {...anchor} />
}
