import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import type { FinalizedContentImage } from '@aurevane/game-core/combat/content-media'
import { FoundationDisciplineSigil } from './foundation-discipline-sigil'
import { DisciplineLibrary } from './character-discipline-build-panel'
const artwork: FinalizedContentImage = {
  id: '00000000-0000-4000-8000-000000000097',
  kind: 'image',
  contentType: 'image/png',
  checksum: 'a'.repeat(64),
  byteLength: 64,
  width: 96,
  height: 96,
  sourceWidth: 120,
  sourceHeight: 120,
  crop: { x: 12, y: 12, size: 96 },
}
it('current authored artwork overrides an existing native sigil and replacement changes its immutable image URL', () => {
  const first = renderToStaticMarkup(
    <FoundationDisciplineSigil disciplineId="vanguard" media={{ artwork }} />,
  )
  expect(first).toContain(`/api/content-media/${artwork.id}`)
  expect(first).toContain('width="96" height="96"')
  const next = { ...artwork, id: '00000000-0000-4000-8000-000000000098' }
  expect(
    renderToStaticMarkup(
      <FoundationDisciplineSigil disciplineId="vanguard" media={{ artwork: next }} />,
    ),
  ).toContain(`/api/content-media/${next.id}`)
  expect(renderToStaticMarkup(<FoundationDisciplineSigil disciplineId="vanguard" />)).not.toContain(
    '/api/content-media/',
  )
})
it('the actual Discipline library sends the selected current definition artwork to the gameplay image', () => {
  const html = renderToStaticMarkup(
    <DisciplineLibrary
      options={[{ definition: { id: 'vanguard', name: 'Current Vanguard', media: { artwork } } }]}
      selectedPrimaryId="vanguard"
      selectedSecondaryId=""
      pendingPreview={false}
      pendingCommit={false}
      refreshingProfile={false}
      primaryRemainingSeconds={0}
      secondaryRemainingSeconds={0}
      activeSlot="primary"
      onSelect={() => {}}
    />,
  )
  expect(html).toContain(`/api/content-media/${artwork.id}`)
})
