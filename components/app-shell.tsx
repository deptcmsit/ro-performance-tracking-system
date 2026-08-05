'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/supabase/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  LogOut,
  Map,
  Monitor,
  ShieldCheck,
  Users,
} from 'lucide-react'

const navItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: BarChart3 },
  { href: '/admin/users', label: 'Recovery Officers', icon: Users },
  { href: '/admin/routes', label: 'Routes', icon: Map },
  { href: '/admin/allocations', label: 'Allocations', icon: ClipboardList },
  { href: '/admin/reports', label: 'Reports', icon: CalendarDays },
  { href: '/sub-admin/dashboard', label: 'Live TV Mode', icon: Monitor },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    await createClient().auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-neutral-200 bg-white/95 p-4 dark:border-neutral-800 dark:bg-neutral-950/95 lg:block">
        <Link href="/admin/dashboard" className="mb-7 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-950 text-white dark:bg-white dark:text-neutral-950">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold">RO Tracker</span>
            <span className="block text-xs text-neutral-500">Operations Portal</span>
          </span>
        </Link>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-white',
                  active && 'bg-neutral-950 text-white hover:bg-neutral-950 hover:text-white dark:bg-white dark:text-neutral-950'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <Button className="absolute bottom-4 left-4 right-4 w-[calc(100%-2rem)]" variant="outline" onClick={handleSignOut}>
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </aside>

      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90 lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link href="/admin/dashboard" className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-5 w-5" />
            RO Tracker
          </Link>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'shrink-0 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium dark:border-neutral-800',
                pathname === item.href && 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </header>

      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  )
}
