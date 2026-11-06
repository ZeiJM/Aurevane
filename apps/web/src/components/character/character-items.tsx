'use client'
import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  EQUIPMENT_POSITIONS,
  type EquipmentPosition,
} from '@aurevane/game-core/character/item-inventory'
import {
  ITEM_INVENTORY_CATEGORIES,
  type ItemInventoryCategory,
} from '@aurevane/game-core/content/items'
import type { CharacterItemsView } from '@/server/character/character-items-service'
import type { CharacterPresentationId } from '@aurevane/game-core/character/creation'
import { getImageAsset } from '@/media/registry'
import { ItemDetails } from './item-details'
import { equipmentStatChanges } from '@/lib/items/equipment-stat-presentation'
import { COMBAT_BONUS_STAT_LABELS } from '@aurevane/game-core/combat/combat-stat-bonuses'
import { itemCategoryLabel, itemClassLabel } from '@/lib/items/item-class-label'
import { CharacterDeletionDialog } from './character-deletion-dialog'
import {
  equipmentProposal,
  itemPositions,
  itemThumbnail,
  positionNames,
  type OwnedItem,
} from './item-equipment-preview'
import styles from './character-items.module.css'
const sortNames = {
  name: 'Name',
  tier: 'Tier',
  'quality-points': 'Quality Points',
  quantity: 'Quantity',
  newest: 'Newest',
  class: 'Type',
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
export function CharacterItems({
  initialView,
  presentationId = 'androgynous',
}: {
  initialView: CharacterItemsView | null
  presentationId?: CharacterPresentationId
}) {
  const [view, setView] = useState(initialView),
    [category, setCategory] = useState<ItemInventoryCategory>('gear'),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all'),
    [sorts, setSorts] = useState<Partial<Record<ItemInventoryCategory, string>>>({}),
    [selected, setSelected] = useState<string | null>(null),
    [inspectionPosition, setInspectionPosition] = useState<EquipmentPosition | null>(null),
    [pickerPosition, setPickerPosition] = useState<EquipmentPosition | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(
      initialView ? null : 'Your Items could not be loaded.',
    ),
    [needsRefresh, setNeedsRefresh] = useState(!initialView)
  const equipmentArtwork = getImageAsset(`ui.equipment.${presentationId}.v1`)
  const pending = useRef(false)
  const mounted = useRef(true)
  const readLatest = useCallback(async () => {
    const response = await fetch('/api/character/items', { cache: 'no-store' })
    const body = await response.json()
    if (!response.ok || !body.view)
      throw new Error(body.error?.message ?? 'Your Items could not be refreshed.')
    if (mounted.current) {
      setView(body.view)
      setNeedsRefresh(false)
    }
  }, [])
  const refresh = useCallback(async () => {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    try {
      await readLatest()
      if (!mounted.current) return
      setError(null)
    } catch (cause) {
      if (!mounted.current) return
      setNeedsRefresh(true)
      setError(cause instanceof Error ? cause.message : 'Your Items could not be loaded.')
    } finally {
      pending.current = false
      if (mounted.current) setBusy(false)
    }
  }, [readLatest])
  useEffect(() => {
    mounted.current = true
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      mounted.current = false
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])
  useEffect(() => {
    if (initialView) return
    const timer = window.setTimeout(() => void refresh(), 0)
    return () => window.clearTimeout(timer)
  }, [initialView, refresh])
  useEffect(() => {
    if (!view?.battleLocked) return
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, 15000)
    return () => window.clearInterval(timer)
  }, [view?.battleLocked, refresh])
  async function mutate(intent: Intent) {
    if (!view || pending.current || view.battleLocked || needsRefresh) return
    pending.current = true
    setBusy(true)
    setError(null)
    let failure: string | null = null
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
      if (!response.ok || !body.view)
        throw new Error(
          body.error?.message ?? 'The change could not be saved. Review your Items and try again.',
        )
      if (!mounted.current) return
      setView(body.view)
      if (intent.action === 'sort')
        setSorts((current) => ({ ...current, [intent.category]: intent.order }))
      if (intent.action !== 'sort') {
        setSelected(null)
        setPickerPosition(null)
      }
    } catch (cause) {
      failure =
        cause instanceof Error
          ? cause.message
          : 'The save could not be confirmed. Review your Items before trying again.'
    } finally {
      // A response may be stale or lost after the server commits. Read once and
      // never replay an equipment or inventory mutation automatically.
      try {
        await readLatest()
      } catch (cause) {
        if (mounted.current) setNeedsRefresh(true)
        const message =
          cause instanceof Error ? cause.message : 'Your Items could not be refreshed.'
        failure = failure ? `${failure} ${message}` : message
      }
      pending.current = false
      if (mounted.current) {
        setError(failure)
        setBusy(false)
      }
    }
  }
  function open(stack: OwnedItem, p?: EquipmentPosition) {
    setSelected(stack.id)
    setInspectionPosition(p ?? null)
    setPickerPosition(null)
    setError(null)
  }
  if (!view)
    return (
      <section className={styles.workspace} aria-label="Arsenal Items" aria-busy={busy}>
        <p role="alert">{error}</p>
      </section>
    )
  const disabled = busy || view.battleLocked || needsRefresh
  const chosen = view.stacks.find((s) => s.id === selected)
  const assigned = chosen ? EQUIPMENT_POSITIONS.filter((p) => view.equipment[p] === chosen.id) : []
  const candidatePositions = chosen?.item ? itemPositions(chosen.item) : []
  const targetPosition = candidatePositions.find((p) => !view.equipment[p]) ?? candidatePositions[0]
  const proposal =
    chosen && targetPosition ? equipmentProposal(view, chosen, targetPosition, []) : null
  const removals =
    inspectionPosition && assigned.includes(inspectionPosition) ? [inspectionPosition] : assigned
  const statChanges = chosen
    ? equipmentStatChanges(
        view.statBonuses,
        removals.length ? removals : (proposal?.removals ?? []),
        removals.length ? [] : (chosen.item?.statBonuses ?? []),
        view.baseEvasion,
        true,
      )
    : []
  const replacedBonuses =
    view.statBonuses?.filter((bonus) => proposal?.removals.includes(bonus.position)) ?? []
  const evasionUnproven =
    [...replacedBonuses, ...(chosen?.item?.statBonuses ?? [])].some(
      (bonus) => bonus.stat === 'evasion' && !bonus.conditional,
    ) &&
    !(
      Number.isSafeInteger(view.baseEvasion) &&
      view.baseEvasion! >= 0 &&
      view.baseEvasion! <= 10000
    )
  const comparisonUnavailable = !view.statBonuses || evasionUnproven
  const blockedReason =
    proposal?.issue ??
    (view.equipmentIssue
      ? 'Repair your equipment before equipping another Item.'
      : proposal?.shortage
        ? 'This equipment would exceed 100 QP.'
        : null)
  const pickerChoices = pickerPosition
    ? view.stacks.filter((stack) => {
        if (!stack.item?.enabled || !itemPositions(stack.item).includes(pickerPosition))
          return false
        if (equipmentProposal(view, stack, pickerPosition, []).shortage) return false
        return !EQUIPMENT_POSITIONS.some(
          (p) =>
            p !== pickerPosition &&
            view.stacks.find((other) => other.id === view.equipment[p])?.itemId === stack.itemId,
        )
      })
    : []
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
        (filter.startsWith('slot:') &&
          !!s.item &&
          itemPositions(s.item).includes(filter.slice(5) as EquipmentPosition)) ||
        filter === s.item?.itemClass)
    )
  }
  const packedMatches =
    search.trim() || filter !== 'all'
      ? categoryStacks.filter(matches).sort((a, b) => a.slotIndex - b.slotIndex)
      : null
  const main = view.stacks.find((s) => s.id === view.equipment['main-hand'])?.item
  const attack = main?.itemClass === 'weapon' ? main : null
  return (
    <section className={styles.workspace} aria-label="Arsenal Items" aria-busy={busy}>
      {view.notices.includes('starter-items-deferred-capacity') ? (
        <p role="status" className={styles.warning}>
          Starter Items have not been granted because there is not enough inventory space. Existing
          Items are unchanged; the grant will be checked again when your inventory updates.
        </p>
      ) : view.notices.includes('starter-items-deferred-battle') ? (
        <p role="status" className={styles.notice}>
          Starter Items will be checked automatically after the battle.
        </p>
      ) : view.notices.includes('starter-items-unavailable') ? (
        <p role="status" className={styles.notice}>
          No starter Items are currently available. Existing Items are unchanged.
        </p>
      ) : null}
      {view.battleLocked ? (
        <p role="status" className={styles.warning}>
          Equipment, sorting and equipment Support changes are locked during a pending or active
          battle. Your Items update automatically after the battle ends.
        </p>
      ) : null}
      <div className={styles.columns}>
        <section className={`${styles.panel} ${styles.equipmentPanel}`} aria-label="Equipment">
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
          ) : null}
          <div className={styles.equipment}>
            <div
              className={styles.mannequin}
              data-equipment-template={presentationId}
              aria-hidden="true"
            >
              <span className={styles.mannequinHalo} />
              {equipmentArtwork.src ? (
                <Image
                  src={equipmentArtwork.src}
                  width={equipmentArtwork.width}
                  height={equipmentArtwork.height}
                  alt=""
                  loading="eager"
                  unoptimized
                />
              ) : null}
            </div>
            {EQUIPMENT_POSITIONS.map((p) => {
              const s = view.stacks.find((s) => s.id === view.equipment[p])
              const blocked = p === 'off-hand' && main?.equipment?.hands === 2
              return (
                <div key={p} className={styles.equipmentCell} data-equipment-position={p}>
                  <button
                    className={styles.equipmentSlot}
                    disabled={!s && blocked}
                    onClick={() => {
                      if (s) open(s, p)
                      else {
                        setPickerPosition(p)
                        setSelected(null)
                        setError(null)
                      }
                    }}
                    aria-label={`${positionNames[p]}: ${blocked ? 'Occupied by two-handed weapon' : (s?.item?.name ?? (s ? 'Unavailable Item' : 'Empty'))}`}
                    aria-description={
                      s?.item?.itemClass === 'battle-item' ? `Quantity ${s.quantity}` : undefined
                    }
                  >
                    <strong>
                      {blocked
                        ? 'Two-handed'
                        : (s?.item?.name ?? (s ? 'Unavailable Item' : 'Empty'))}
                    </strong>
                    <small>
                      {blocked
                        ? 'Off Hand blocked'
                        : s?.item
                          ? `${s.item.qualityPoints} QP`
                          : s
                            ? 'Remove to repair'
                            : 'Unequipped'}
                    </small>
                    <span className={styles.equipmentArtwork}>
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
                      {s?.item?.itemClass === 'battle-item' ? (
                        <span className={styles.quantity} aria-hidden="true">
                          ×{s.quantity}
                        </span>
                      ) : null}
                    </span>
                  </button>
                  <span className={styles.positionName} aria-hidden="true">
                    {positionNames[p]}
                  </span>
                </div>
              )
            })}
          </div>
          <div className={styles.attack}>
            <strong>Basic Attack slot: {attack?.actions.attack ? attack.name : 'Unarmed'}</strong>
          </div>
        </section>
        <section className={styles.panel} aria-label="Inventory">
          <div className={styles.panelHeading}>
            <h3>Inventory</h3>
            <small>{categoryStacks.length} / 40 slots</small>
          </div>
          <div className={styles.tabs} aria-label="Item classes">
            {ITEM_INVENTORY_CATEGORIES.map((c) => (
              <button
                key={c}
                aria-pressed={category === c}
                onClick={() => {
                  setCategory(c)
                  setFilter('all')
                }}
              >
                {itemCategoryLabel(c)}
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
            {category === 'gear' || category === 'battle-items' ? (
              <label>
                Filter
                <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                  <option value="all">All Items</option>
                  <option value="equippable">Equippable</option>
                  {category === 'gear' ? (
                    <>
                      <optgroup label="Position">
                        {(['head', 'body', 'pants', 'boots', 'main-hand', 'off-hand'] as const).map(
                          (s) => (
                            <option key={s} value={`slot:${s}`}>
                              {positionNames[s]}
                            </option>
                          ),
                        )}
                      </optgroup>
                      <optgroup label="Type">
                        {['armor', 'hand-armor', 'weapon'].map((c) => (
                          <option key={c} value={c}>
                            {itemClassLabel(c)}
                          </option>
                        ))}
                      </optgroup>
                    </>
                  ) : null}
                </select>
              </label>
            ) : null}
            <label>
              Sort
              <select
                disabled={disabled}
                value={sorts[category] ?? ''}
                onChange={(e) => void mutate({ action: 'sort', category, order: e.target.value })}
              >
                <option value="" disabled>
                  Saved order
                </option>
                {Object.entries(sortNames)
                  .filter(
                    ([value]) =>
                      (value !== 'quantity' || category !== 'gear') &&
                      (value !== 'class' || category === 'gear') &&
                      (value !== 'quality-points' ||
                        category === 'gear' ||
                        category === 'battle-items'),
                  )
                  .map(([value, name]) => (
                    <option key={value} value={value}>
                      {name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          {error && !chosen && !pickerPosition ? (
            <p role="alert" className={styles.warning}>
              {error}
            </p>
          ) : null}
          <p className={styles.muted}>
            Sorting saves automatically. Search and filters show matching Items.
          </p>
          <div className={styles.inventoryScroll}>
            <div
              className={styles.inventory}
              aria-label={`${itemCategoryLabel(category)} inventory slots`}
            >
              {Array.from({ length: 40 }, (_, index) => {
                const s = packedMatches ? packedMatches[index] : bySlot.get(index)
                return (
                  <div key={index} data-inventory-slot={index + 1} className={styles.inventoryCell}>
                    {s ? (
                      <button
                        className={styles.item}
                        data-tier={s.item?.tier}
                        onClick={() => open(s)}
                        aria-label={`Slot ${s.slotIndex + 1}: ${s.item?.name ?? 'Unavailable Item'}, quantity ${s.quantity}${Object.values(view.equipment).includes(s.id) ? ', equipped' : ''}`}
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
                          <span className={styles.equipped}>
                            <span aria-hidden="true">✓</span> Equipped
                          </span>
                        ) : null}
                      </button>
                    ) : (
                      <span className={styles.slotNumber} aria-label={`Slot ${index + 1}: Empty`}>
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
          className={`${styles.dialog} ${!chosen.item?.equipment ? styles.compactDialog : ''}`}
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
              <ItemDetails item={chosen.item} showName={false} />
            ) : (
              <p className={styles.warning}>
                This owned Item is unavailable in the current catalogue. It remains in inventory.
                Unequip it to repair your loadout.
              </p>
            )}
            <div className={styles.equipmentActions}>
              <div className={styles.actionButtons}>
                {removals.length ? (
                  removals.map((p) => (
                    <button
                      key={p}
                      disabled={disabled}
                      onClick={() => void mutate({ action: 'unequip', position: p })}
                    >
                      {removals.length > 1 ? `Unequip ${positionNames[p]}` : 'Unequip'}
                    </button>
                  ))
                ) : chosen.item?.equipment && targetPosition ? (
                  <button
                    disabled={disabled || !!blockedReason}
                    title={blockedReason ?? undefined}
                    onClick={() =>
                      void mutate({
                        action: 'equip',
                        stackId: chosen.id,
                        position: targetPosition,
                        replacePositions: proposal?.requiredReplacements ?? [],
                      })
                    }
                  >
                    Equip
                  </button>
                ) : (
                  <button disabled>Cannot be equipped</button>
                )}
              </div>
              {!removals.length && proposal?.requiredReplacements.length ? (
                <section className={styles.statComparison} aria-label="Equipment comparison">
                  <h4>Stat changes if equipped</h4>
                  <p className={styles.replacedItems}>
                    Replacing:{' '}
                    {[
                      ...new Set(
                        proposal.removals.map(
                          (position) =>
                            view.stacks.find((stack) => stack.id === view.equipment[position])?.item
                              ?.name ?? 'Unavailable Item',
                        ),
                      ),
                    ].join(' · ')}
                  </p>
                  <dl className={styles.statChanges} aria-label="Equipment stat changes">
                    {!statChanges.length || comparisonUnavailable ? (
                      <div className={styles.statNeutral}>
                        {comparisonUnavailable
                          ? evasionUnproven
                            ? 'Evasion comparison unavailable'
                            : 'Stat comparison unavailable'
                          : 'No fixed stat change'}
                      </div>
                    ) : null}
                    {statChanges.map(({ stat, amount }) => (
                      <div key={stat}>
                        <dt>{COMBAT_BONUS_STAT_LABELS[stat].replace(/ \(.*\)$/, '')}</dt>
                        <dd
                          className={
                            amount > 0
                              ? styles.statIncrease
                              : amount < 0
                                ? styles.statDecrease
                                : styles.statNeutral
                          }
                          data-equipment-stat-change={amount}
                        >
                          {amount > 0 ? '+' : amount < 0 ? '−' : ''}
                          {stat === 'evasion' ? `${Math.abs(amount) / 100}%` : Math.abs(amount)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ) : null}
            </div>
            {!removals.length && blockedReason ? (
              <p role="status" className={styles.muted}>
                {blockedReason}
              </p>
            ) : null}
            {error ? (
              <p role="alert" className={styles.warning}>
                {error}
              </p>
            ) : null}
          </div>
        </CharacterDeletionDialog>
      ) : null}
      {pickerPosition ? (
        <CharacterDeletionDialog
          titleId="item-picker-title"
          busy={busy}
          onDismiss={() => setPickerPosition(null)}
          className={styles.dialog}
          surface="ink"
        >
          <header className={styles.dialogHeading}>
            <h2 id="item-picker-title">Equip {positionNames[pickerPosition]}</h2>
            <button autoFocus disabled={busy} onClick={() => setPickerPosition(null)}>
              Close
            </button>
          </header>
          <div className={styles.dialogBody}>
            {pickerChoices.length ? (
              <div
                className={styles.pickerChoices}
                aria-label={`Owned Items for ${positionNames[pickerPosition]}`}
              >
                {pickerChoices.map((stack) => {
                  const choice = equipmentProposal(view, stack, pickerPosition, [])
                  const reason =
                    choice.issue ??
                    (choice.shortage
                      ? 'This equipment would exceed 100 QP.'
                      : view.equipmentIssue?.message)
                  return (
                    <button
                      key={stack.id}
                      disabled={disabled || !!reason}
                      title={reason ?? undefined}
                      onClick={() =>
                        void mutate({
                          action: 'equip',
                          stackId: stack.id,
                          position: pickerPosition,
                          replacePositions: choice.requiredReplacements,
                        })
                      }
                    >
                      {stack.item?.artworkSrc ? (
                        <Image
                          src={itemThumbnail(stack.item.artworkSrc)}
                          width={36}
                          height={36}
                          alt=""
                          unoptimized
                        />
                      ) : null}
                      <span>
                        {stack.item?.name}{' '}
                        {stack.item?.itemClass === 'battle-item' ? (
                          <small className={styles.pickerQuantity}>×{stack.quantity}</small>
                        ) : null}
                      </span>
                      {reason ? <small>{reason}</small> : null}
                    </button>
                  )
                })}
              </div>
            ) : (
              <p role="status">
                No owned Items can be equipped in {positionNames[pickerPosition]}.
              </p>
            )}
            {view.battleLocked ? (
              <p role="status">Equipment changes are locked during battle.</p>
            ) : null}
            {error ? (
              <p role="alert" className={styles.warning}>
                {error}
              </p>
            ) : null}
          </div>
        </CharacterDeletionDialog>
      ) : null}
    </section>
  )
}
