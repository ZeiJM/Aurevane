// Source-level diagnosis only: this does not simulate browser interaction or layout.
const assert = require('node:assert/strict')
const { createHash } = require('node:crypto')
const { readFileSync } = require('node:fs')
const { createRequire } = require('node:module')
const path = require('node:path')
const vm = require('node:vm')
const webRequire = createRequire(path.resolve('apps/web/package.json'))
const ts = webRequire('typescript')
const playwrightRequire = createRequire(webRequire.resolve('@playwright/test'))
const coreRequire = createRequire(playwrightRequire.resolve('playwright'))
const corePath = path.join(
  path.dirname(coreRequire.resolve('playwright-core/package.json')),
  'lib/coreBundle.js',
)
const core = readFileSync(corePath, 'utf8')
const coreTree = ts.createSourceFile(corePath, core, ts.ScriptTarget.Latest, true)
let injected
function visit(node, callback) {
  callback(node)
  ts.forEachChild(node, (child) => visit(child, callback))
}
visit(coreTree, (node) => {
  if (
    ts.isBinaryExpression(node) &&
    node.left.getText(coreTree) === 'source4' &&
    ts.isStringLiteral(node.right)
  )
    injected = node.right.text
})
assert(injected?.includes('function getElementLabels'))
const names = [
  'normalizeWhiteSpace',
  'shouldSkipForTextMatching',
  'elementText',
  'getAriaLabelledByElements',
  'getElementLabels',
  'createTextMatcher',
]
const injectedTree = ts.createSourceFile('injected.js', injected, ts.ScriptTarget.Latest, true)
const functions = new Map()
visit(injectedTree, (node) => {
  if (ts.isFunctionDeclaration(node) && names.includes(node.name?.text))
    functions.set(node.name.text, node.getText(injectedTree))
})
assert.equal(functions.size, names.length)
const context = vm.createContext({
  Node: { ELEMENT_NODE: 1, TEXT_NODE: 3, COMMENT_NODE: 8 },
  HTMLInputElement: class {},
})
vm.runInContext('let normalizedWhitespaceCache;\n' + [...functions.values()].join('\n'), context)
const componentPath = 'apps/web/src/components/master/staff-management.tsx'
const component = readFileSync(componentPath, 'utf8')
const componentTree = ts.createSourceFile(
  componentPath,
  component,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
)
const labels = []
visit(componentTree, (node) => {
  if (ts.isJsxElement(node) && node.openingElement.tagName.getText(componentTree) === 'label')
    labels.push(node)
})
function dom(node) {
  if (ts.isJsxText(node)) return { nodeType: 3, nodeValue: node.text.trim() }
  if (!ts.isJsxElement(node) && !ts.isJsxSelfClosingElement(node)) return null
  const opening = ts.isJsxElement(node) ? node.openingElement : node
  const attributes = Object.fromEntries(
    opening.attributes.properties
      .filter(ts.isJsxAttribute)
      .map((attr) => [
        attr.name.getText(componentTree),
        attr.initializer && ts.isStringLiteral(attr.initializer) ? attr.initializer.text : null,
      ]),
  )
  const children = ts.isJsxElement(node) ? node.children.map(dom).filter(Boolean) : []
  children.forEach((child, index) => {
    child.nextSibling = children[index + 1] ?? null
  })
  return {
    nodeType: 1,
    nodeName: opening.tagName.getText(componentTree).toUpperCase(),
    ownerDocument: { head: null },
    firstChild: children[0] ?? null,
    children,
    getAttribute: (name) => attributes[name] ?? null,
  }
}
const results = []
for (const [id, query, exact] of [
  ['staff-expiry', 'Duration', true],
  ['staff-days', 'Days', true],
]) {
  const jsx = labels.find((label) =>
    label.openingElement.attributes.properties.some(
      (attr) =>
        ts.isJsxAttribute(attr) &&
        attr.name.getText(componentTree) === 'htmlFor' &&
        attr.initializer?.text === id,
    ),
  )
  assert(jsx)
  const label = dom(jsx)
  const control = label.children.find((child) => ['SELECT', 'INPUT'].includes(child.nodeName))
  control.labels = [label]
  context.control = control
  context.selector = JSON.stringify(query) + (exact ? 's' : 'i')
  results.push(
    vm.runInContext(
      '({ label: getElementLabels(new Map(), control)[0].normalized, matches: getElementLabels(new Map(), control).some(createTextMatcher(selector, true).matcher) })',
      context,
    ),
  )
}
assert.equal(results[0].label, 'DurationNo ExpiryNumber of days')
assert.equal(results[0].matches, false)
assert.equal(results[1].label, 'Days')
assert.equal(results[1].matches, true)
console.log(
  JSON.stringify(
    {
      playwright: coreRequire('playwright-core/package.json').version,
      coreSha256: createHash('sha256').update(core).digest('hex'),
      componentSha256: createHash('sha256').update(component).digest('hex'),
      results,
      conclusion:
        'Exact Duration label cannot match; exact Days label can. Native ARIA snapshots independently identify combobox Duration. Browser execution remains required.',
    },
    null,
    2,
  ),
)
