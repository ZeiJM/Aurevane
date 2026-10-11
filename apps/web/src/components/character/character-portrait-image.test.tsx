import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { CharacterPortraitImage } from './character-portrait-image'

vi.mock('@/components/media/aurevane-image', () => ({ AurevaneImage: () => null }))

describe('visible character portraits', () => {
  it('starts a critical direct portrait eagerly at high priority while preserving GIF URLs', () => {
    const markup = renderToStaticMarkup(
      <CharacterPortraitImage
        imageUrl="https://portraits.example/zei.gif"
        fallbackAssetId="character.creation.square-portrait-01"
        priority
      />,
    )
    expect(markup).toContain('loading="eager"')
    expect(markup).toContain('fetchPriority="high"')
    expect(markup).toContain('src="https://portraits.example/zei.gif"')
    expect(markup).toContain('referrerPolicy="no-referrer"')
  })
  it('keeps noncritical collection portraits lazy', () => {
    const markup = renderToStaticMarkup(
      <CharacterPortraitImage
        imageUrl="https://portraits.example/zei.webp"
        fallbackAssetId="character.creation.square-portrait-01"
      />,
    )
    expect(markup).toContain('loading="lazy"')
    expect(markup).not.toContain('fetchPriority="high"')
  })
})
