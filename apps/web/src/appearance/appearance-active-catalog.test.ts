import { describe, expect, it } from 'vitest'
import {
  activePaintedLooksForGender,
  findActivePaintedLook,
  isActivePaintedAppearance,
  pickActivePaintedLook,
} from './appearance-active-catalog'
import { PORTRAIT_FACES } from './appearance-face-catalog'
import { featuredDaryaHairstyle, featuredStudy } from './appearance-featured-variants'
import {
  appearanceManifestFromImageUrl,
  compileAppearanceManifest,
  paintedPlayerAppearanceBlueprint,
} from './appearance-manifest'
import { appearanceGenderForIdentity, canAuthorPlayerLook } from './appearance-painted-looks'
import { renderAppearanceAsset } from './appearance-svg'

describe('painted look catalogue', () => {
  it.each(['feminine', 'masculine'] as const)(
    'has 500 distinct %s looks and 1,500 distinct saveable variants',
    (gender) => {
      const choices = activePaintedLooksForGender(gender)
      expect(choices).toHaveLength(500)
      expect(new Set(choices.map(({ key }) => key)).size).toBe(500)
      expect(new Set(choices.map(({ label }) => label)).size).toBe(500)
      const faces = new Set<string | undefined>()
      const ids = new Set<string>()
      for (const choice of choices) {
        expect(choice.variants).toHaveLength(3)
        const [base] = choice.variants
        faces.add(base.faceId)
        for (const [variant, look] of choice.variants.entries()) {
          expect(appearanceGenderForIdentity(look.identity)).toBe(gender)
          expect(canAuthorPlayerLook(look)).toBe(true)
          expect(look).toMatchObject({
            faceId: base.faceId,
            bodyFrame: base.bodyFrame,
            outerwear: base.outerwear,
            hairstyle: base.hairstyle,
          })
          const blueprint = paintedPlayerAppearanceBlueprint(look)
          const manifest = compileAppearanceManifest(blueprint)
          expect(appearanceManifestFromImageUrl(manifest.neutralUrl)?.id).toBe(manifest.id)
          expect(appearanceManifestFromImageUrl(manifest.portraits.neutral)?.id).toBe(manifest.id)
          expect(manifest.portraits.neutral.endsWith('/illustrated-posed-neutral.svg')).toBe(
            variant > 0,
          )
          expect(isActivePaintedAppearance(blueprint)).toBe(true)
          expect(findActivePaintedLook({ ...look, backdrop: 'original' })).toEqual({
            choice,
            variant,
          })
          ids.add(manifest.id)
        }
      }
      expect(ids.size).toBe(1500)
      expect(faces).toEqual(
        new Set(
          PORTRAIT_FACES.filter(({ rig }) => appearanceGenderForIdentity(rig) === gender).map(
            ({ id }) => id,
          ),
        ),
      )
      const looks = choices.flatMap(({ variants }) => variants)
      expect(looks.some(({ outerwear }) => outerwear === 'brigandine')).toBe(true)
      expect(new Set(looks.map(({ irisPattern }) => irisPattern))).toEqual(
        new Set([undefined, 'paired', 'central', 'sectoral']),
      )
      expect(new Set(looks.map(({ scar }) => scar)).size).toBeGreaterThan(8)
      expect(looks.some(({ hairHighlight }) => hairHighlight)).toBe(true)
    },
  )

  it('retains featured paintings and gives them distinct motion and portrait variants', () => {
    const choices = activePaintedLooksForGender().filter(
      ({ group }) => group === 'Featured paintings',
    )
    expect(choices).toHaveLength(10)
    for (const { variants } of choices) {
      expect(
        new Set(variants.map((look) => featuredStudy(look) ?? featuredDaryaHairstyle(look))).size,
      ).toBe(1)
      expect(featuredStudy(variants[2]) ?? featuredDaryaHairstyle(variants[2])).toBeDefined()
    }
    for (const key of ['aren', 'asta', 'darya-coils']) {
      const choice = choices.find((candidate) => candidate.key === key)!
      const images = choice.variants.map(paintedPlayerAppearanceBlueprint)
      const portraits = images.map((look) => renderAppearanceAsset(look, 'neutral', true, true))
      const motions = images.map((look) => renderAppearanceAsset(look, 'motion-v3', true))
      expect(new Set(portraits).size).toBe(3)
      expect(portraits[0]).not.toContain('portrait-stance-painting')
      expect(portraits[1]).toContain('portrait-stance-painting')
      expect(portraits[2]).toContain('portrait-stance-painting')
      expect(new Set(motions).size).toBe(3)
      expect(motions[0]).toContain('translate(24 40) rotate(-45)')
      expect(motions[0]).toContain('rotate(1.65 24 55)')
      const idleCell = (atlas: string) => atlas.match(/<svg x="0" y="0"[^>]*>(.*?)<\/svg>/s)?.[1]
      expect(idleCell(motions[0]!)).toMatch(/south-idle/)
      expect(idleCell(motions[1]!)).toMatch(/south-(brace|passing)/)
      expect(idleCell(motions[2]!)).toMatch(/south-cast/)
    }
  })

  it('randomizes within gender and changes the base look', () => {
    const [choice] = activePaintedLooksForGender('feminine')
    const look = pickActivePaintedLook('feminine', () => 0.999, choice!.variants[1])
    expect(appearanceGenderForIdentity(look.identity)).toBe('feminine')
    expect(findActivePaintedLook(look)?.choice.key).not.toBe(choice!.key)
    expect(findActivePaintedLook(look)?.variant).toBe(2)
  })
})
