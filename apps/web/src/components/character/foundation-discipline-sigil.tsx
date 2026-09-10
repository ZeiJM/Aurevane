import type { ReactNode } from 'react'

interface FoundationDisciplineSigilProps {
  disciplineId: string
  className?: string
}

function Frame({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 96 96"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path
        d="M48 5 77 17 91 48 77 79 48 91 19 79 5 48 19 17 48 5Z"
        strokeWidth="2"
        opacity="0.22"
      />
      <path
        d="M48 10 72 20 84 48 72 76 48 86 24 76 12 48 24 20 48 10Z"
        strokeWidth="1.5"
        opacity="0.16"
      />
      {children}
    </svg>
  )
}

export function FoundationDisciplineSigil({
  disciplineId,
  className,
}: FoundationDisciplineSigilProps) {
  if (disciplineId === 'vanguard') {
    return (
      <Frame className={className}>
        <path d="M48 16 70 25v20c0 16-8 28-22 37C34 73 26 61 26 45V25l22-9Z" strokeWidth="4" />
        <path d="M48 23v46M35 38h26" strokeWidth="4" />
        <path d="m30 61 18 12 18-12" strokeWidth="3" opacity="0.7" />
        <path d="M48 26 37 33l11 6 11-6-11-7Z" fill="currentColor" stroke="none" opacity="0.16" />
      </Frame>
    )
  }

  if (disciplineId === 'farstrider') {
    return (
      <Frame className={className}>
        <circle cx="48" cy="48" r="26" strokeWidth="3" />
        <circle cx="48" cy="48" r="15" strokeWidth="2" opacity="0.48" />
        <path d="m62 25-8 21-23 13 20-4 16 16" strokeWidth="4" />
        <path d="M17 48h12M67 48h12M48 17v10M48 69v10" strokeWidth="3" opacity="0.72" />
        <path d="m54 46 13-21-8 24Z" fill="currentColor" stroke="none" opacity="0.18" />
      </Frame>
    )
  }

  if (disciplineId === 'shadehand') {
    return (
      <Frame className={className}>
        <path d="M69 20c-19 2-34 16-36 34-1 12 5 21 16 25 12 4 24-1 31-13-15 5-28-2-31-13-4-14 5-28 20-33Z" strokeWidth="4" />
        <path d="m24 70 21-22M21 52l24-4M35 78l10-30" strokeWidth="3" opacity="0.76" />
        <path d="m64 31-10 11 15-4-5-7Z" fill="currentColor" stroke="none" opacity="0.28" />
        <path d="M26 30c6-5 12-8 19-10" strokeWidth="2" opacity="0.45" />
      </Frame>
    )
  }

  if (disciplineId === 'ironfist') {
    return (
      <Frame className={className}>
        <path d="m48 14 9 17 19 3-13 14 5 19-20-8-20 8 5-19-13-14 19-3 9-17Z" strokeWidth="4" />
        <path d="m34 37 14 11 14-11M33 61l15-13 15 13" strokeWidth="3.4" />
        <path d="M23 23 14 32M73 23l9 9M17 70l11-9M79 70l-11-9" strokeWidth="3" opacity="0.72" />
        <path d="m48 27 7 10-7 8-7-8 7-10Z" fill="currentColor" stroke="none" opacity="0.2" />
      </Frame>
    )
  }

  if (disciplineId === 'aetherist') {
    return (
      <Frame className={className}>
        <circle cx="48" cy="48" r="12" strokeWidth="3.5" />
        <circle cx="48" cy="48" r="29" strokeWidth="2.5" strokeDasharray="5 7" opacity="0.72" />
        <path d="M48 12v21M48 63v21M12 48h21M63 48h21" strokeWidth="3" />
        <path d="m23 23 15 15M58 58l15 15M73 23 58 38M38 58 23 73" strokeWidth="2.6" opacity="0.78" />
        <path d="m48 34 8 14-8 14-8-14 8-14Z" fill="currentColor" stroke="none" opacity="0.22" />
      </Frame>
    )
  }

  if (disciplineId === 'lifebinder') {
    return (
      <Frame className={className}>
        <path d="M48 81V35" strokeWidth="4" />
        <path d="M48 48C31 48 21 38 21 23c16 0 27 9 27 25ZM48 41c17 0 27-10 27-25-16 0-27 9-27 25Z" strokeWidth="3.5" />
        <circle cx="48" cy="61" r="17" strokeWidth="3" />
        <path d="M35 61h26M48 48v26" strokeWidth="3" />
        <path d="M29 69c6 7 12 10 19 12M67 69c-6 7-12 10-19 12" strokeWidth="2.4" opacity="0.64" />
        <path d="M48 24c7 3 11 8 12 15-6-1-10-5-12-15Z" fill="currentColor" stroke="none" opacity="0.2" />
      </Frame>
    )
  }

  return (
    <Frame className={className}>
      <circle cx="48" cy="48" r="25" strokeWidth="3" />
      <path d="m48 24 7 15 17 2-12 12 3 17-15-8-15 8 3-17-12-12 17-2 7-15Z" strokeWidth="3.5" />
    </Frame>
  )
}
