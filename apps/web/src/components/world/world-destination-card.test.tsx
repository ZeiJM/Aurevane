import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { WorldDestinationCard } from './world-destination-card'
import type { WorldAtlasCell } from '@/world/types'
const destination: WorldAtlasCell = {
  id: 'test-town',
  name: 'Review destination',
  column: 58,
  row: 28,
  coordinate: 'S59-29',
  regionId: 'aureth-crown',
  charted: true,
}
function buttons(
  element: ReactElement,
): ReactElement<{ children: ReactNode; onClick: () => void; disabled?: boolean }>[] {
  return Children.toArray((element.props as { children?: ReactNode }).children).flatMap((child) =>
    isValidElement(child)
      ? [
          ...(child.type === 'button'
            ? [
                child as ReactElement<{
                  children: ReactNode
                  onClick: () => void
                  disabled?: boolean
                }>,
              ]
            : []),
          ...buttons(child),
        ]
      : [],
  )
}
it('requires a separate inline review before calling travel and retains cancel/clear controls', () => {
  const props = {
    destination,
    disabled: false,
    reviewing: false,
    replacesRoute: false,
    onReview: vi.fn(),
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    onClear: vi.fn(),
  }
  const unarmed = WorldDestinationCard(props)
  const markup = renderToStaticMarkup(unarmed)
  expect(markup).not.toContain('role="dialog"')
  expect(markup).not.toContain('aria-modal')
  expect(markup).not.toContain('Confirm travel')
  buttons(unarmed)
    .find((button) => button.props.children === 'Travel here')!
    .props.onClick()
  expect(props.onReview).toHaveBeenCalledOnce()
  expect(props.onConfirm).not.toHaveBeenCalled()
  const reviewing = WorldDestinationCard({ ...props, reviewing: true, replacesRoute: true })
  expect(renderToStaticMarkup(reviewing)).toContain('This journey will replace your current route.')
  expect(renderToStaticMarkup(reviewing)).toContain(
    'role="group" aria-label="Confirm world travel"',
  )
  buttons(reviewing)
    .find((button) => button.props.children === 'Cancel')!
    .props.onClick()
  expect(props.onCancel).toHaveBeenCalledOnce()
  expect(props.onConfirm).not.toHaveBeenCalled()
  buttons(reviewing)
    .find((button) => button.props.children === 'Confirm travel')!
    .props.onClick()
  expect(props.onConfirm).toHaveBeenCalledOnce()
})
it('keeps travel disabled and gives the destination close control an accessible name', () => {
  const props = {
    destination,
    disabled: true,
    reviewing: true,
    replacesRoute: false,
    onReview: vi.fn(),
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    onClear: vi.fn(),
  }
  const card = WorldDestinationCard(props)
  expect(
    buttons(card).find((button) => button.props.children === 'Confirm travel')!.props.disabled,
  ).toBe(true)
  expect(renderToStaticMarkup(card)).toContain('aria-label="Clear destination"')
  const close = buttons(card).find(
    (button) => (button.props as Record<string, unknown>)['aria-label'] === 'Clear destination',
  )!
  close.props.onClick()
  expect(props.onClear).toHaveBeenCalledOnce()
})
