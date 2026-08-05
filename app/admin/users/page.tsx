import { AppShell } from '@/components/app-shell'
import { UserManagement } from '@/features/admin/UserManagement'

export default function UsersPage() {
  return (
    <AppShell>
      <UserManagement />
    </AppShell>
  )
}
