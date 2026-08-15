export interface MigrationPolicyViolation {
  code: 'PUBLIC_TABLE_WITHOUT_RLS' | 'RLS_DISABLED' | 'BROAD_PUBLIC_GRANT'
  message: string
  table?: string
}

const PUBLIC_TABLE_PATTERN =
  /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:"?public"?\.)"?([a-zA-Z0-9_]+)"?/gi

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function inspectMigrationSecurity(sql: string): MigrationPolicyViolation[] {
  const violations: MigrationPolicyViolation[] = []

  if (/disable\s+row\s+level\s+security/gi.test(sql)) {
    violations.push({
      code: 'RLS_DISABLED',
      message: 'Migrations must not disable Row Level Security.',
    })
  }

  if (/grant\s+all(?:\s+privileges)?\s+on[\s\S]+?\s+to\s+(?:public|anon|authenticated)\b/gi.test(sql)) {
    violations.push({
      code: 'BROAD_PUBLIC_GRANT',
      message: 'Broad GRANT ALL privileges to public/anon/authenticated are not allowed.',
    })
  }

  for (const match of sql.matchAll(PUBLIC_TABLE_PATTERN)) {
    const table = match[1]
    const escapedTable = escapeRegExp(table)
    const enableRlsPattern = new RegExp(
      `alter\\s+table\\s+(?:only\\s+)?(?:"?public"?\\.)"?${escapedTable}"?\\s+enable\\s+row\\s+level\\s+security`,
      'i',
    )

    if (!enableRlsPattern.test(sql)) {
      violations.push({
        code: 'PUBLIC_TABLE_WITHOUT_RLS',
        table,
        message: `Public table ${table} must enable Row Level Security in the same migration.`,
      })
    }
  }

  return violations
}
