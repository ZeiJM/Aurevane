import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { WorldInteraction } from '@/world/types'
import { WorldConversation } from './world-conversation'

describe('WorldConversation', () => {
  it('renders only the projected local dialogue and authored action', () => {
    const interaction: WorldInteraction = {
      id: 'eastern-watch-officer',
      objectiveId: 'eastern-watch',
      title: 'The Eastern Watch',
      speaker: 'Watch officer',
      body: 'The eastern tower has gone quiet. Confirm it is standing, then report back.',
      actionLabel: 'Accept objective',
      progress: 'available',
    }
    const markup = renderToStaticMarkup(
      createElement(WorldConversation, {
        interaction,
        locationName: 'Verdant Expanse',
        disabled: false,
        onAction: vi.fn(),
        onClose: vi.fn(),
      }),
    )

    expect(markup).toContain('role="dialog"')
    expect(markup).toContain('Watch officer')
    expect(markup).toContain('Verdant Expanse')
    expect(markup).toContain('Accept objective')
    expect(markup).toContain('End conversation')
    expect(markup).not.toContain('Crown Hinterland')
  })

  it('shows state without inventing an action when the server projects none', () => {
    const interaction: WorldInteraction = {
      id: 'eastern-watch-officer',
      objectiveId: 'eastern-watch',
      title: 'The Eastern Watch',
      speaker: 'Watch officer',
      body: 'The watch officer is waiting for your report from the eastern tower.',
      actionLabel: null,
      progress: 'active',
    }
    const markup = renderToStaticMarkup(
      createElement(WorldConversation, {
        interaction,
        locationName: 'Verdant Expanse',
        disabled: false,
        onAction: vi.fn(),
        onClose: vi.fn(),
      }),
    )

    expect(markup).toContain('Your current objective is already underway.')
    expect(markup).not.toContain('Accept objective')
    expect(markup).not.toContain('Report back')
  })
})
