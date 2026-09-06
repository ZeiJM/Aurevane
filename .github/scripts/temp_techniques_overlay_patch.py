from pathlib import Path

component = Path('apps/web/src/components/character/character-skill-build-panel.tsx')
text = component.read_text()
text = text.replace(
    "import { useState, type CSSProperties } from 'react'\n",
    "import { useEffect, useState, type CSSProperties } from 'react'\nimport { createPortal } from 'react-dom'\n",
    1,
)
anchor = "  const [pending, setPending] = useState(false)\n  const [message, setMessage] = useState<string | null>(null)\n\n"
insert = "  const [pending, setPending] = useState(false)\n  const [message, setMessage] = useState<string | null>(null)\n\n  useEffect(() => {\n    if (!open) return\n\n    const previousBodyOverflow = document.body.style.overflow\n    const previousDocumentOverflow = document.documentElement.style.overflow\n    document.body.style.overflow = 'hidden'\n    document.documentElement.style.overflow = 'hidden'\n\n    return () => {\n      document.body.style.overflow = previousBodyOverflow\n      document.documentElement.style.overflow = previousDocumentOverflow\n    }\n  }, [open])\n\n"
if anchor not in text:
    raise SystemExit('state anchor not found')
text = text.replace(anchor, insert, 1)
text = text.replace(
    "      {open ? (\n        <div\n          className={styles.backdrop}\n",
    "      {open && typeof document !== 'undefined'\n        ? createPortal(\n            <div\n              className={styles.backdrop}\n              data-techniques-overlay=\"true\"\n",
    1,
)
closing = "          </section>\n        </div>\n      ) : null}\n"
replacement = "          </section>\n            </div>,\n            document.body,\n          )\n        : null}\n"
if closing not in text:
    raise SystemExit('portal closing anchor not found')
text = text.replace(closing, replacement, 1)
component.write_text(text)

css = Path('apps/web/src/components/character/character-skill-build-panel.module.css')
styles = css.read_text()
styles = styles.replace(
    "  z-index: 1200;\n  display: grid;",
    "  z-index: 5000;\n  display: grid;\n  isolation: isolate;",
    1,
)
styles = styles.replace(
    "radial-gradient(circle at 82% 12%, rgba(56, 118, 103, 0.12), transparent 28%), rgb(2 5 9 / 88%);",
    "radial-gradient(circle at 82% 12%, rgba(56, 118, 103, 0.12), transparent 28%), rgb(2 5 9 / 96%);",
    1,
)
styles = styles.replace('  backdrop-filter: blur(12px);', '  backdrop-filter: blur(16px);', 1)
styles = styles.replace(
    ".dialog {\n  display: flex;",
    ".dialog {\n  position: relative;\n  z-index: 1;\n  display: flex;",
    1,
)
css.write_text(styles)

spec = Path('apps/web/e2e/p3-8-representative-buildcraft.pw.ts')
test = spec.read_text()
needle = "  await page.getByRole('button', { name: /Tag Techniques/ }).click()\n  await expect(page.getByTestId('skill-capacity')).toHaveText('0 / 4')\n"
replacement = "  await page.getByRole('button', { name: /Tag Techniques/ }).click()\n  const techniquesOverlay = page.locator('body > [data-techniques-overlay=\"true\"]')\n  await expect(techniquesOverlay).toBeVisible()\n  await expect(techniquesOverlay.getByRole('dialog', { name: 'Techniques' })).toBeVisible()\n  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe(\n    'hidden',\n  )\n  await expect(page.getByTestId('skill-capacity')).toHaveText('0 / 4')\n"
if needle not in test:
    raise SystemExit('e2e anchor not found')
test = test.replace(needle, replacement, 1)
spec.write_text(test)
