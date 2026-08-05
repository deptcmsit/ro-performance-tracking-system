import { AppShell } from '@/components/app-shell'
import { RouteManagement } from '@/features/admin/ResourceManagement'

export default function RoutesPage() {
  return (
    <AppShell>
      <RouteManagement />
    </AppShell>
  )
}
