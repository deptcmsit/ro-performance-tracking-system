import { AppShell } from '@/components/app-shell'
import { AllocationManagement } from '@/features/admin/ResourceManagement'

export default function AllocationsPage() {
  return (
    <AppShell>
      <AllocationManagement />
    </AppShell>
  )
}
