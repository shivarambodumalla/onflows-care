import type { ReactNode } from 'react'
import { StateView } from '@/design-system'
import { usePermission } from '@/data/store'
import { ROLE_LABELS } from '@/data/types'
import { useApp } from '@/data/store'
import type { Permission } from '@/data/permissions'

/**
 * Part 22 — Permission Denied.
 *
 * Guarded routes render the denied state rather than redirecting. A redirect
 * would hide the very thing the prototype needs to demonstrate: that the
 * permission matrix has teeth and the user can see where the wall is.
 */
export function RouteGuard({
  permission,
  children,
}: {
  permission: Permission
  children: ReactNode
}) {
  const allowed = usePermission(permission)
  const { role } = useApp()

  if (allowed) return <>{children}</>

  return (
    <StateView
      kind="denied"
      size="page"
      title="You do not have access to this"
      description={`The ${ROLE_LABELS[role]} role cannot open this section. Switch the demo role in the top bar, or ask an administrator for access.`}
    />
  )
}
