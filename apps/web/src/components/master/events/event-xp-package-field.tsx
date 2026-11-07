'use client'

import type { EventWorkspaceCatalogue } from '@/server/master/event-authoring-service'

type Rewards = readonly EventWorkspaceCatalogue['rewards'][number][]

export function EventXpPackageField({
  label,
  value,
  other,
  rewards,
  optional = false,
  change,
}: {
  label: string
  value: string
  other?: string
  optional?: boolean
  rewards: Rewards
  change: (next: string) => void
}) {
  return (
    <label>
      {label}
      <select aria-label={label} value={value} onChange={(event) => change(event.target.value)}>
        <option value="">
          {optional
            ? 'No repeat XP'
            : rewards.length
              ? 'Choose a package'
              : 'No XP packages available'}
        </option>
        {value && !rewards.some((reward) => reward.key === value) ? (
          <option value={value}>{value} · unavailable</option>
        ) : null}
        {rewards.map((reward) => (
          <option
            key={reward.key}
            value={reward.key}
            disabled={reward.key === other && reward.key !== value}
          >
            {reward.label} · {reward.key}
          </option>
        ))}
      </select>
    </label>
  )
}
