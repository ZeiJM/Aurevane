import { createHash } from 'node:crypto'

import { STARTER_CHARACTER_PORTRAITS } from '@aurevane/game-core/character/starter-options'
import { describe, expect, it } from 'vitest'

import provenance from '../../public/media/art/concept-ui/provenance.json'

import { getStarterPortraitImageAssetId } from './character'
import {
  getImageAsset,
  imageAssetRegistry,
  validateImageRegistry,
  validateRegisteredImageAssets,
} from './registry'

function dataImageSha256(src: string | undefined): string {
  const payload = src?.match(/^data:image\/webp;base64,(.+)$/)?.[1]
  expect(payload).toBeTruthy()
  return createHash('sha256').update(Buffer.from(payload!, 'base64')).digest('hex')
}

describe('image registry', () => {
  it('keeps approved artwork traceable with valid runtime descriptors', () => {
    expect(validateRegisteredImageAssets()).toEqual([])
  })

  it('resolves the approved environment and starter portraits through existing runtime IDs', () => {
    expect(getImageAsset('ui.foundation.vista')).toMatchObject({
      status: 'approved',
      src: '/media/art/concept-ui/world-v01.webp',
      width: 1536,
      height: 1024,
    })
    expect(getImageAsset('ui.foundation.vista-mobile')).toMatchObject({
      src: '/media/art/concept-ui/world-mobile-v01.webp',
      width: 768,
      height: 1024,
    })
    for (const id of [
      'character.creation.portrait-01',
      'character.creation.portrait-02',
      'character.creation.portrait-03',
      'character.creation.portrait-04',
    ] as const) {
      expect(getImageAsset(id)).toMatchObject({
        status: 'approved',
        width: 768,
        height: 1152,
        decorative: false,
      })
      expect(getImageAsset(id).src).toMatch(/^\/media\/art\/concept-ui\/portrait-0[1-4]-v01\.webp$/)
    }
  })

  it('routes every starter portrait choice through a square runtime descriptor', () => {
    for (const [index, portrait] of STARTER_CHARACTER_PORTRAITS.entries()) {
      const size = portrait.ref.startsWith('portrait.adventure.') ? 384 : index === 0 ? 400 : 1024
      const asset = getImageAsset(getStarterPortraitImageAssetId(portrait.ref))
      expect(asset).toMatchObject({
        status: 'approved',
        width: size,
        height: size,
        decorative: false,
      })
    }
  })

  it('keeps portrait 01 byte-identical while resolving every replacement through a new static URL', () => {
    expect(dataImageSha256(getImageAsset('character.creation.square-portrait-01').src)).toBe(
      '52ccf2550c6480d48210a88baf318e258d93b245f527fa552a4ccdbb437809e3',
    )
    for (let number = 2; number <= 40; number += 1) {
      const suffix = String(number).padStart(2, '0')
      const ref =
        `portrait.starter.wayfarer-${suffix}` as (typeof STARTER_CHARACTER_PORTRAITS)[number]['ref']
      expect(getImageAsset(getStarterPortraitImageAssetId(ref))).toMatchObject({
        src: `/media/art/wayfarer/portrait-${suffix}-v02.webp`,
        width: 1024,
        height: 1024,
      })
    }
  })

  it('describes the visible traits distinguishing each starter portrait', () => {
    const descriptions = [
      ['character.creation.portrait-01', /blond.*silver armor.*green cloak/i],
      ['character.creation.portrait-02', /silver hair.*violet cloak.*crystal/i],
      ['character.creation.portrait-03', /short dark curls.*green cloak.*bow/i],
      ['character.creation.portrait-04', /short black hair.*teal cloak.*bracers/i],
    ] as const
    for (const [id, description] of descriptions) {
      expect(getImageAsset(id).alt).toMatch(description)
      expect(getImageAsset(id).alt).not.toMatch(/portrait option/i)
    }
  })

  it('links every concept runtime descriptor to its generation record while retaining legacy requests', () => {
    const generatedAssets = [...imageAssetRegistry.values()].filter((asset) =>
      asset.src?.startsWith('/media/art/concept-ui/'),
    )
    expect(generatedAssets).toHaveLength(11)
    for (const asset of generatedAssets) {
      expect(asset).toHaveProperty('generationRequestId', provenance.requestId)
    }
    expect(getImageAsset('ui.foundation.vista').requestId).toBe('ART-UI-001')
    expect(getImageAsset('character.creation.portrait-01').requestId).toBe('ART-CHR-001')
  })

  it('rejects approved meaningful art without runtime dimensions and alt text', () => {
    expect(
      validateImageRegistry([
        {
          id: 'ui.invalid',
          kind: 'environment',
          status: 'approved',
          requestId: 'ART-UI-999',
          decorative: false,
          alt: '',
          src: '/media/art/ui/invalid.webp',
        },
      ]),
    ).toEqual([
      'Approved image asset ui.invalid requires source, width, and height.',
      'Meaningful image asset ui.invalid requires alt text.',
    ])
  })
})
