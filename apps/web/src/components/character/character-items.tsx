'use client'
import Image from 'next/image'
import { useRef, useState } from 'react'
import {
  EQUIPMENT_POSITIONS,
  type EquipmentPosition,
} from '@aurevane/game-core/character/item-inventory'
import {
  ITEM_INVENTORY_CATEGORIES,
  type ItemInventoryCategory,
} from '@aurevane/game-core/content/items'
import type { CharacterItemsView } from '@/server/character/character-items-service'
import { ItemDetails } from './item-details'
import { CharacterDeletionDialog } from './character-deletion-dialog'
import {
  equipmentProposal,
  itemPositions,
  itemThumbnail,
  positionNames,
  type OwnedItem,
} from './item-equipment-preview'
import styles from './character-items.module.css'
const categoryNames: Record<ItemInventoryCategory, string> = {
  gear: 'Gear',
  'battle-items': 'Battle Items',
  materials: 'Materials',
  general: 'General',
  event: 'Event',
  companion: 'Companion',
}
const sortNames = {
  name: 'Name',
  tier: 'Tier',
  'quality-points': 'Quality Points',
  quantity: 'Quantity',
  newest: 'Newest',
  class: 'Class',
}
type Intent =
  | {
      action: 'equip'
      stackId: string
      position: EquipmentPosition
      replacePositions: EquipmentPosition[]
    }
  | { action: 'unequip'; position: EquipmentPosition }
  | { action: 'sort'; category: ItemInventoryCategory; order: string }
export function CharacterItems({ initialView }: { initialView: CharacterItemsView | null }) {
  const [view, setView] = useState(initialView),
    [category, setCategory] = useState<ItemInventoryCategory>('gear'),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all'),
    [sort, setSort] = useState('name'),
    [selected, setSelected] = useState<string | null>(null),
    [position, setPosition] = useState<EquipmentPosition>('head'),
    [extra, setExtra] = useState<EquipmentPosition[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(
      initialView ? null : 'Your Items could not be loaded.',
    ),
    [notice, setNotice] = useState<string | null>(null),
    [needsReload, setNeedsReload] = useState(false)
  const pending = useRef(false)
  async function reload() {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    try {
      const response = await fetch('/api/character/items', { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok || !body.view)
        throw new Error(body.error?.message ?? 'Your Items could not be loaded.')
      setView(body.view)
      setError(null)
      setNeedsReload(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your Items could not be loaded.')
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  async function mutate(intent: Intent) {
    if (!view || pending.current || view.battleLocked || needsReload) return
    pending.current = true
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch('/api/character/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: view.characterId,
          expectedRevision: view.revision,
          catalogueToken: view.catalogueToken,
          ...intent,
        }),
      })
      const body = await response.json()
      if (!response.ok || !body.view) {
        setNeedsReload(true)
        throw new Error(
          body.error?.message ?? 'The change could not be saved. Reload Items before trying again.',
        )
      }
      setView(body.view)
      setExtra([])
      setNotice(
        body.view.notices.includes('equipment-support-removed')
          ? 'Your equipment Support Action was removed. Your previous Basic Support Action is selected.'
          : 'Items saved.',
      )
      if (intent.action !== 'sort') setSelected(null)
    } catch (cause) {
      setNeedsReload(true)
      setError(
        cause instanceof Error
          ? cause.message
          : 'The save could not be confirmed. Reload Items before trying again.',
      )
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  function open(stack: OwnedItem, p?: EquipmentPosition) {
    setSelected(stack.id)
    setPosition(p ?? (stack.item ? itemPositions(stack.item)[0] : undefined) ?? 'head')
    setExtra([])
  }
  if (!view)
    return (
      <section className={styles.workspace}>
        <p role="alert">{error}</p>
        <button disabled={busy} onClick={() => void reload()}>
          Reload Items
        </button>
      </section>
    )
  const disabled = busy || view.battleLocked || needsReload
  const chosen = view.stacks.find((s) => s.id === selected)
  const proposal = chosen ? equipmentProposal(view, chosen, position, extra) : null
  const categoryStacks = view.stacks.filter((s) => s.inventoryCategory === category)
  const bySlot = new Map(categoryStacks.map((s) => [s.slotIndex, s]))
  function matches(s: OwnedItem) {
    return (
      (!search ||
        `${s.item?.name ?? 'Unavailable Item'} ${s.item?.tags.join(' ') ?? ''}`
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (filter === 'all' ||
        (filter === 'equippable' && s.item?.enabled && !!s.item.equipment) ||
        (filter === 'unavailable' && (!s.item || !s.item.enabled)) ||
        (filter.startsWith('slot:') && s.item?.equipment?.slot === filter.slice(5)) ||
        filter === s.item?.itemClass)
    )
  }
  const main = view.stacks.find((s) => s.id === view.equipment['main-hand'])?.item
  const off = view.stacks.find((s) => s.id === view.equipment['off-hand'])?.item
  const attack = main?.itemClass === 'weapon' ? main : off?.itemClass === 'weapon' ? off : null
  return (
    <section className={styles.workspace} aria-label="Arsenal Items" aria-busy={busy}>
      <header className={styles.title}>
        <div>
          <span className={styles.eyebrow}>ARSENAL · ITEMS</span>
          <h2>Ready for the road</h2>
          <p>Equip your discoveries. Every piece has its place.</p>
        </div>
        <button disabled={busy} onClick={() => void reload()}>
          Reload Items
        </button>
      </header>
      {error ? (
        <p role="alert" className={styles.warning}>
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className={styles.notice}>
          {notice}
        </p>
      ) : null}
      {view.notices.includes('starter-items-deferred-capacity') ? (
        <p role="status" className={styles.warning}>
          Starter Items have not been granted because there is not enough inventory space. Existing
          Items are unchanged; the grant will be tried again on reload.
        </p>
      ) : view.notices.includes('starter-items-deferred-battle') ? (
        <p role="status" className={styles.notice}>
          Starter Items will be granted after the battle. Reload Items when it ends.
        </p>
      ) : view.notices.includes('starter-items-unavailable') ? (
        <p role="status" className={styles.notice}>
          No starter Items are currently available. Existing Items are unchanged.
        </p>
      ) : null}
      {view.battleLocked ? (
        <p role="status" className={styles.warning}>
          Equipment, sorting and Support changes are locked during a pending or active battle.
          Reload Items after the battle ends.
        </p>
      ) : null}
      <div className={styles.columns}>
        <section className={styles.panel} aria-label="Equipment">
          <div className={styles.panelHeading}>
            <h3>Equipment</h3>
            <strong>
              {view.equipmentIssue
                ? 'QP incomplete · repair required'
                : `${view.qualityPoints} / 100 QP`}
            </strong>
          </div>
          <meter
            min={0}
            max={100}
            value={Math.min(view.qualityPoints, 100)}
            aria-label={
              view.equipmentIssue
                ? 'Known Quality Points; equipment invalid'
                : 'Equipped Quality Points'
            }
          />
          {view.equipmentIssue ? (
            <div className={styles.warning}>
              <strong>Repair equipment</strong>
              <p>{view.equipmentIssue.message}</p>
              <p>
                Known equipment: {view.qualityPoints} QP. Battle admission remains blocked until
                repaired.
              </p>
            </div>
          ) : (
            <p className={styles.muted}>{100 - view.qualityPoints} QP available</p>
          )}
          <div className={styles.equipment}>
            {EQUIPMENT_POSITIONS.map((p) => {
              const s = view.stacks.find((s) => s.id === view.equipment[p])
              const blocked = p === 'off-hand' && main?.equipment?.hands === 2
              return (
                <button
                  key={p}
                  className={styles.equipmentSlot}
                  disabled={!s}
                  onClick={() => s && open(s, p)}
                  aria-label={`${positionNames[p]}: ${blocked ? 'Occupied by two-handed weapon' : (s?.item?.name ?? (s ? 'Unavailable Item' : 'Empty'))}`}
                >
                  <span>{positionNames[p]}</span>
                  {s?.item?.artworkSrc ? (
                    <Image
                      src={itemThumbnail(s.item.artworkSrc)}
                      width={84}
                      height={84}
                      alt=""
                      unoptimized
                    />
                  ) : (
                    <span className={styles.emptyIcon} aria-hidden="true">
                      {blocked ? '◆' : '◇'}
                    </span>
                  )}
                  <strong>
                    {blocked ? 'Two-handed' : (s?.item?.name ?? (s ? 'Unavailable Item' : 'Empty'))}
                  </strong>
                  <small>
                    {blocked
                      ? 'Off Hand blocked'
                      : s?.item
                        ? `${s.item.qualityPoints} QP`
                        : s
                          ? 'Remove to repair'
                          : 'Select from inventory'}
                  </small>
                </button>
              )
            })}
          </div>
          <div className={styles.attack}>
            <strong>Basic Attack · {attack?.actions.attack?.name ?? 'Unarmed'}</strong>
            <p>
              {attack ? `${attack.name} supplies your attack.` : 'No weapon equipped.'}{' '}
              {main?.itemClass === 'weapon' && off?.itemClass === 'weapon'
                ? 'Off Hand contributes passives only.'
                : ''}
            </p>
          </div>
          <p className={styles.muted}>
            One Support Action is selected in Arsenal Techniques. Unequipping its source restores
            your previous Basic choice.
          </p>
        </section>
        <section className={styles.panel} aria-label="Inventory">
          <div className={styles.panelHeading}>
            <h3>Inventory</h3>
            <small>{categoryStacks.length} / 40 slots</small>
          </div>
          <div className={styles.tabs} aria-label="Inventory categories">
            {ITEM_INVENTORY_CATEGORIES.map((c) => (
              <button key={c} aria-pressed={category === c} onClick={() => setCategory(c)}>
                {categoryNames[c]}
              </button>
            ))}
          </div>
          <div className={styles.controls}>
            <label>
              Search
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name or tag"
              />
            </label>
            <label>
              Filter
              <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="all">All Items</option>
                <option value="equippable">Equippable</option>
                <option value="unavailable">Unavailable</option>
                <optgroup label="Equipment slot">
                  {['head', 'body', 'pants', 'boots', 'hand'].map((s) => (
                    <option key={s} value={`slot:${s}`}>
                      {s}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Class">
                  {[
                    'armor',
                    'hand-armor',
                    'weapon',
                    'battle-item',
                    'material',
                    'general',
                    'event',
                    'companion',
                  ].map((c) => (
                    <option key={c} value={c}>
                      {c.replaceAll('-', ' ')}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
            <label>
              Sort
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                {Object.entries(sortNames).map(([value, name]) => (
                  <option key={value} value={value}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={disabled}
              onClick={() => void mutate({ action: 'sort', category, order: sort })}
            >
              Save order
            </button>
          </div>
          <p className={styles.muted}>
            Sort order is saved to your character. Search and filters keep each Item in its saved
            slot.
          </p>
          <div className={styles.inventoryScroll}>
            <div
              className={styles.inventory}
              aria-label={`${categoryNames[category]} inventory slots`}
            >
              {Array.from({ length: 40 }, (_, index) => {
                const s = bySlot.get(index)
                const visible = s && matches(s)
                return (
                  <div key={index} data-inventory-slot={index + 1} className={styles.inventoryCell}>
                    {visible ? (
                      <button
                        className={styles.item}
                        data-tier={s.item?.tier}
                        onClick={() => open(s)}
                        aria-label={`Slot ${index + 1}: ${s.item?.name ?? 'Unavailable Item'}, quantity ${s.quantity}`}
                        title={s.item?.name ?? 'Unavailable Item'}
                      >
                        {s.item?.artworkSrc ? (
                          <Image
                            src={itemThumbnail(s.item.artworkSrc)}
                            width={112}
                            height={112}
                            alt=""
                            unoptimized
                          />
                        ) : (
                          <span aria-hidden="true">?</span>
                        )}
                        <span className={styles.quantity}>×{s.quantity}</span>
                        <span className={styles.itemName}>
                          {s.item?.name ?? 'Unavailable Item'}
                        </span>
                        {Object.values(view.equipment).includes(s.id) ? (
                          <span className={styles.equipped}>Equipped</span>
                        ) : null}
                      </button>
                    ) : (
                      <span
                        className={styles.slotNumber}
                        aria-label={`Slot ${index + 1}: ${s ? 'Filtered' : 'Empty'}`}
                      >
                        {index + 1}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      </div>
      {chosen ? (
        <CharacterDeletionDialog
          titleId="item-dialog-title"
          busy={busy}
          onDismiss={() => setSelected(null)}
          className={styles.dialog}
          surface="ink"
        >
          <header className={styles.dialogHeading}>
            <h2 id="item-dialog-title">{chosen.item?.name ?? 'Unavailable Item'}</h2>
            <button autoFocus disabled={busy} onClick={() => setSelected(null)}>
              Close
            </button>
          </header>
          <div className={styles.dialogBody}>
            {chosen.item ? (
              <ItemDetails item={chosen.item} />
            ) : (
              <p className={styles.warning}>
                This owned Item is unavailable in the current catalogue (archived, missing or no
                longer a runtime Item). It remains in inventory. Remove its equipment assignment to
                repair your loadout.
              </p>
            )}
            {EQUIPMENT_POSITIONS.filter((p) => view.equipment[p] === chosen.id).map((p) => (
              <button
                className={styles.remove}
                key={p}
                disabled={disabled}
                onClick={() => void mutate({ action: 'unequip', position: p })}
              >
                Unequip {positionNames[p]}
              </button>
            ))}
            {chosen.item?.equipment ? (
              <section className={styles.proposal} aria-label="Equipment comparison">
                <h3>Compare & equip</h3>
                <label>
                  Equip position
                  <select
                    value={position}
                    onChange={(e) => {
                      setPosition(e.target.value as EquipmentPosition)
                      setExtra([])
                    }}
                  >
                    {itemPositions(chosen.item).map((p) => (
                      <option key={p} value={p}>
                        {positionNames[p]}
                      </option>
                    ))}
                  </select>
                </label>
                <p>
                  {positionNames[position]}:{' '}
                  {view.stacks.find((s) => s.id === view.equipment[position])?.item?.name ??
                    (view.equipment[position] ? 'Unavailable Item' : 'Empty')}{' '}
                  → {chosen.item.name}
                </p>
                {view.stacks.find((s) => s.id === view.equipment[position])?.item ? (
                  <details>
                    <summary>Compare currently equipped Item report</summary>
                    <ItemDetails
                      item={view.stacks.find((s) => s.id === view.equipment[position])!.item!}
                    />
                  </details>
                ) : null}
                <p>
                  QP: {view.qualityPoints} → {proposal?.qualityPoints} / 100
                </p>
                {proposal?.removals.length ? (
                  <p className={styles.warning}>
                    Confirm replacement:{' '}
                    {proposal.removals
                      .map(
                        (p) =>
                          `${positionNames[p]} (${view.stacks.find((s) => s.id === view.equipment[p])?.item?.name ?? 'Unavailable Item'})`,
                      )
                      .join(', ')}{' '}
                    will be unequipped.
                  </p>
                ) : null}
                {proposal?.shortage ? (
                  <p role="status" className={styles.warning}>
                    Short by {proposal.shortage} QP. Choose equipment to remove below.
                  </p>
                ) : null}
                <fieldset>
                  <legend>Optional equipment to remove in this swap</legend>
                  {EQUIPMENT_POSITIONS.filter(
                    (p) =>
                      view.equipment[p] &&
                      p !== position &&
                      !proposal?.requiredReplacements.includes(p),
                  ).map((p) => {
                    const current = view.stacks.find((s) => s.id === view.equipment[p])
                    return (
                      <label key={p}>
                        <input
                          type="checkbox"
                          checked={extra.includes(p)}
                          onChange={(e) =>
                            setExtra(
                              e.target.checked ? [...extra, p] : extra.filter((v) => v !== p),
                            )
                          }
                        />
                        {positionNames[p]} · {current?.item?.name ?? 'Unavailable Item'} ·{' '}
                        {current?.item?.qualityPoints ?? '?'} QP
                      </label>
                    )
                  })}
                </fieldset>
                {view.selectedSupport.kind === 'equipment' &&
                proposal?.removals.includes(view.selectedSupport.position) ? (
                  <p className={styles.warning}>
                    This removes your selected Support source; your previous Basic Support Action
                    will be restored.
                  </p>
                ) : null}
                {proposal?.issue ? (
                  <p role="status" className={styles.warning}>
                    {proposal.issue}
                  </p>
                ) : null}
                {view.equipmentIssue ? (
                  <p className={styles.warning}>
                    Resolve the current equipment issue before equipping. Unequip invalid pieces
                    above.
                  </p>
                ) : null}
                <button
                  className={styles.confirm}
                  disabled={
                    disabled ||
                    !!proposal?.issue ||
                    !!proposal?.shortage ||
                    !!view.equipmentIssue ||
                    view.equipment[position] === chosen.id
                  }
                  onClick={() =>
                    void mutate({
                      action: 'equip',
                      stackId: chosen.id,
                      position,
                      replacePositions: proposal?.removals ?? [],
                    })
                  }
                >
                  {proposal?.removals.length ? 'Confirm swap' : 'Equip'} · {positionNames[position]}
                </button>
              </section>
            ) : (
              <p className={styles.muted}>
                Flavor and future-purpose Item. No equipment or battle action.
              </p>
            )}
            {error ? (
              <p role="alert" className={styles.warning}>
                {error}
              </p>
            ) : null}
            {needsReload ? (
              <button disabled={busy} onClick={() => void reload()}>
                Reload Items
              </button>
            ) : null}
          </div>
        </CharacterDeletionDialog>
      ) : null}
    </section>
  )
}
