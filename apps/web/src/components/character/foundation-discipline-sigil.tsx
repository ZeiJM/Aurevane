interface FoundationDisciplineSigilProps {
  disciplineId: string
  className?: string
}

export function FoundationDisciplineSigil({
  disciplineId,
  className,
}: FoundationDisciplineSigilProps) {
  const common = {
    className,
    viewBox: '0 0 64 64',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 3.4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  if (disciplineId === 'vanguard') {
    return (
      <svg {...common}>
        <path d="M32 6 50 13v15c0 13-7.7 23-18 30C21.7 51 14 41 14 28V13L32 6Z" />
        <path d="M32 15v31M22 26h20" />
      </svg>
    )
  }

  if (disciplineId === 'farstrider') {
    return (
      <svg {...common}>
        <circle cx="32" cy="32" r="21" />
        <path d="m39 17-4.5 12.5L22 36l12.5-1.5L42 47" />
        <path d="M12 32h8M44 32h8" />
      </svg>
    )
  }

  if (disciplineId === 'shadehand') {
    return (
      <svg {...common}>
        <path d="M45 11c-13 2-23 11-26 23-2 8 1 15 8 19 8 4 18 1 24-7-11 3-20-2-22-10-3-10 4-20 16-25Z" />
        <path d="m18 46 10-10M15 35l13 1" />
      </svg>
    )
  }

  if (disciplineId === 'ironfist') {
    return (
      <svg {...common}>
        <path d="m32 7 7 11 12 5-7 9 5 13-12-2-5 14-5-14-12 2 5-13-7-9 12-5 7-11Z" />
        <path d="m23 25 9 7 9-7M22 39l10-7 10 7" />
        <path d="M17 13 9 21M47 13l8 8M12 49l8-8M52 49l-8-8" />
      </svg>
    )
  }

  if (disciplineId === 'aetherist') {
    return (
      <svg {...common}>
        <circle cx="32" cy="32" r="7" />
        <path d="M32 7v13M32 44v13M7 32h13M44 32h13" />
        <path d="m14 14 9 9M41 41l9 9M50 14l-9 9M23 41l-9 9" />
        <circle cx="32" cy="32" r="20" strokeDasharray="4 7" />
      </svg>
    )
  }

  if (disciplineId === 'lifebinder') {
    return (
      <svg {...common}>
        <path d="M32 55V25" />
        <path d="M32 34c-12 0-19-7-19-18 11 0 19 6 19 18ZM32 29c12 0 19-7 19-18-11 0-19 6-19 18Z" />
        <path d="M22 44h20M32 34v20" />
        <circle cx="32" cy="44" r="11" />
      </svg>
    )
  }

  return (
    <svg {...common}>
      <circle cx="32" cy="32" r="21" />
      <path d="m32 17 5 10 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2 5-10Z" />
    </svg>
  )
}
