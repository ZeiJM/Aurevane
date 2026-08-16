'use client'

import { createBrowserClient } from '@supabase/ssr'

import { getPublicSupabaseConfig, type PublicSupabaseConfig } from './config'

export type BrowserSupabaseConfig = Pick<PublicSupabaseConfig, 'url' | 'publishableKey'>

export function createSupabaseBrowserClient(config?: BrowserSupabaseConfig) {
  const resolvedConfig = config ?? getPublicSupabaseConfig()

  return createBrowserClient(resolvedConfig.url, resolvedConfig.publishableKey)
}
