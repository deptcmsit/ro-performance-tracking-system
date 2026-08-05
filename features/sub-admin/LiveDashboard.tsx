'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buildDailyRows, formatDateTime, formatTime, statusClass, todayInColombo } from '@/lib/portal'
import { createClient } from '@/supabase/client'
import type { Allocation, Attendance, DailyAttendanceRow, LocationUpdate, Route, User } from '@/types'
import { LogOut, MapPin, Monitor, Navigation, Search, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

const filters: Array<'All' | DailyAttendanceRow['status']> = ['All', 'Working', 'Absent']

export function LiveDashboard() {
  const [users, setUsers] = useState<User[]>([])
  const [routes, setRoutes] = useState<Route[]>([])
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [locations, setLocations] = useState<LocationUpdate[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [locationTrackingReady, setLocationTrackingReady] = useState(true)
  const [statusFilter, setStatusFilter] = useState<(typeof filters)[number]>('All')
  const [routeFilter, setRouteFilter] = useState('All')
  const [query, setQuery] = useState('')
  const [now, setNow] = useState(new Date())
  const router = useRouter()

  const refresh = useCallback(async () => {
    const supabase = createClient()
    const today = todayInColombo()
    const [usersRes, routesRes, allocationsRes, attendanceRes, locationsRes] = await Promise.all([
      supabase.from('users').select('*').order('employee_no'),
      supabase.from('routes').select('*').order('route_name'),
      supabase.from('allocations').select('*').order('allocation_name'),
      supabase.from('attendance').select('*').eq('work_date', today),
      supabase.from('ro_locations').select('*').eq('work_date', today).order('created_at', { ascending: false }),
    ])
    setUsers((usersRes.data || []) as User[])
    setRoutes((routesRes.data || []) as Route[])
    setAllocations((allocationsRes.data || []) as Allocation[])
    setAttendance((attendanceRes.data || []) as Attendance[])
    setLocations((locationsRes.data || []) as LocationUpdate[])
    setLocationTrackingReady(!locationsRes.error)
  }, [])

  useEffect(() => {
    refresh()
    const supabase = createClient()
    const channel = supabase
      .channel('sub-admin-live-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'routes' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'allocations' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ro_locations' }, refresh)
      .subscribe()
    const timer = window.setInterval(() => setNow(new Date()), 1000)

    return () => {
      window.clearInterval(timer)
      supabase.removeChannel(channel)
    }
  }, [refresh])

  const rows = useMemo(() => {
    const needle = query.toLowerCase()
    return buildDailyRows(users, attendance, routes, allocations).filter((row) => {
      const statusMatch = statusFilter === 'All' || row.status === statusFilter
      const routeMatch = routeFilter === 'All' || row.route_name === routeFilter
      const queryMatch = [row.employee_no, row.name, row.route_name || '', row.allocations.join(' ')].some((item) =>
        item.toLowerCase().includes(needle)
      )
      return statusMatch && routeMatch && queryMatch
    })
  }, [users, attendance, routes, allocations, query, routeFilter, statusFilter])

  const allRows = useMemo(() => buildDailyRows(users, attendance, routes, allocations), [users, attendance, routes, allocations])
  const working = allRows.filter((row) => row.status === 'Working').length
  const absent = allRows.filter((row) => row.status === 'Absent').length
  const latestLocationByUser = useMemo(() => {
    const latest = new Map<string, LocationUpdate>()
    locations.forEach((location) => {
      if (!latest.has(location.user_id)) latest.set(location.user_id, location)
    })
    return latest
  }, [locations])
  const selectedRow = allRows.find((row) => row.user_id === selectedUserId) || null
  const selectedLocations = selectedUserId ? locations.filter((location) => location.user_id === selectedUserId) : []
  const selectedLatestLocation = selectedLocations[0]

  async function signOut() {
    await createClient().auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-neutral-950 p-4 text-white sm:p-6">
      <div className="mx-auto flex max-w-[1800px] flex-col gap-5">
        <header className="flex flex-col justify-between gap-4 rounded-lg border border-neutral-800 bg-neutral-900 px-5 py-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-500 text-neutral-950">
              <Monitor className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Live RO Operations</h1>
              <p className="text-sm text-neutral-400">Sub Admin TV Mode | {todayInColombo()}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-3xl font-semibold tabular-nums">
                {new Intl.DateTimeFormat('en-LK', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: true,
                  timeZone: 'Asia/Colombo',
                }).format(now)}
              </p>
              <p className="text-xs text-neutral-400">Realtime enabled</p>
            </div>
            <Button variant="outline" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          <TvMetric label="Total ROs" value={allRows.length} />
          <TvMetric label="Working Today" value={working} tone="emerald" />
          <TvMetric label="Absent Today" value={absent} />
        </section>

        <section className="grid gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-3 lg:grid-cols-[1fr_220px_220px]">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-neutral-500" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search employee, name, route, allocation"
              className="h-11 border-neutral-700 bg-neutral-950 pl-10 text-base text-white"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as (typeof filters)[number])}
            className="h-11 rounded-md border border-neutral-700 bg-neutral-950 px-3 text-sm text-white"
          >
            {filters.map((filter) => (
              <option key={filter} value={filter}>
                {filter}
              </option>
            ))}
          </select>
          <select
            value={routeFilter}
            onChange={(event) => setRouteFilter(event.target.value)}
            className="h-11 rounded-md border border-neutral-700 bg-neutral-950 px-3 text-sm text-white"
          >
            <option value="All">All Routes</option>
            {routes.map((route) => (
              <option key={route.id} value={route.route_name}>
                {route.route_name}
              </option>
            ))}
          </select>
        </section>

        {!locationTrackingReady && (
          <section className="rounded-lg border border-amber-900 bg-amber-950/30 p-4 text-sm text-amber-200">
            Location tracking database table is not active yet. Run supabase/location-upgrade.sql once in Supabase to enable current and past RO locations.
          </section>
        )}

        {selectedRow && (
          <section className="grid gap-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4 xl:grid-cols-[360px_1fr]">
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-neutral-400">{selectedRow.employee_no}</p>
                  <h2 className="mt-1 text-2xl font-semibold">{selectedRow.name}</h2>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSelectedUserId(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-4 grid gap-2 text-sm text-neutral-300">
                <div className="flex justify-between gap-3">
                  <span>Status</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(selectedRow.status)}`}>{selectedRow.status}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Route</span>
                  <span>{selectedRow.route_name || '-'}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Check in</span>
                  <span>{formatTime(selectedRow.check_in_time)}</span>
                </div>
              </div>

              {selectedLatestLocation ? (
                <a
                  href={`https://www.google.com/maps?q=${selectedLatestLocation.latitude},${selectedLatestLocation.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-neutral-950 hover:bg-emerald-400"
                >
                  <Navigation className="h-4 w-4" />
                  Open Current Location
                </a>
              ) : (
                <div className="mt-5 rounded-lg border border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-400">
                  No GPS location update sent today.
                </div>
              )}
            </div>

            <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-neutral-400">Current and Past Locations</p>
                  <p className="text-xs text-neutral-500">Latest update is shown first</p>
                </div>
                <span className="rounded-full bg-neutral-800 px-3 py-1 text-xs font-semibold">{selectedLocations.length} updates</span>
              </div>

              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {selectedLocations.map((location, index) => (
                  <a
                    key={location.id}
                    href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="grid gap-2 rounded-lg border border-neutral-800 p-3 text-sm hover:border-neutral-600 hover:bg-neutral-900 sm:grid-cols-[auto_1fr_auto]"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-800 text-emerald-300">
                      <MapPin className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block font-semibold text-neutral-100">
                        {index === 0 ? 'Current location' : `Past location ${index}`}
                      </span>
                      <span className="block text-neutral-400">{formatDateTime(location.created_at)}</span>
                      {location.note && <span className="mt-1 block text-neutral-300">{location.note}</span>}
                    </span>
                    <span className="text-neutral-500">
                      {location.accuracy_meters ? `${Math.round(location.accuracy_meters)}m` : '-'}
                    </span>
                  </a>
                ))}
                {selectedLocations.length === 0 && <p className="text-sm text-neutral-500">No location history available for this RO today.</p>}
              </div>
            </div>
          </section>
        )}

        <section className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900">
          <Table>
            <TableHeader>
              <TableRow className="border-neutral-800 hover:bg-neutral-900">
                <TableHead className="h-12 text-neutral-400">Employee</TableHead>
                <TableHead className="text-neutral-400">Name</TableHead>
                <TableHead className="text-neutral-400">Current Status</TableHead>
                <TableHead className="text-neutral-400">Working Today</TableHead>
                <TableHead className="text-neutral-400">Current Route</TableHead>
                <TableHead className="text-neutral-400">Current Location</TableHead>
                <TableHead className="text-neutral-400">Check In</TableHead>
                <TableHead className="text-neutral-400">Check Out</TableHead>
                <TableHead className="text-neutral-400">Allocations</TableHead>
                <TableHead className="text-neutral-400">Last Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const latestLocation = latestLocationByUser.get(row.user_id)
                return (
                <TableRow
                  key={row.employee_no}
                  className="cursor-pointer border-neutral-800 hover:bg-neutral-800/60"
                  onClick={() => setSelectedUserId(row.user_id)}
                >
                  <TableCell className="py-4 text-lg font-semibold text-white">{row.employee_no}</TableCell>
                  <TableCell className="text-base text-neutral-100">{row.name}</TableCell>
                  <TableCell>
                    <span className={`inline-flex min-w-28 justify-center rounded-full px-3 py-1.5 text-sm font-bold ${statusClass(row.status)}`}>
                      {row.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-neutral-200">{row.is_working_today === null ? '-' : row.is_working_today ? 'Yes' : 'No'}</TableCell>
                  <TableCell className="text-neutral-200">{row.route_name}</TableCell>
                  <TableCell>
                    {latestLocation ? (
                      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-950 px-3 py-1 text-xs font-semibold text-emerald-300">
                        <MapPin className="h-3.5 w-3.5" />
                        {formatTime(latestLocation.created_at)}
                      </span>
                    ) : (
                      <span className="text-neutral-500">No update</span>
                    )}
                  </TableCell>
                  <TableCell className="text-neutral-200">{formatTime(row.check_in_time)}</TableCell>
                  <TableCell className="text-neutral-200">{formatTime(row.check_out_time)}</TableCell>
                  <TableCell className="max-w-72 truncate text-neutral-200">{row.allocations.join(', ') || '-'}</TableCell>
                  <TableCell className="text-neutral-400">{formatDateTime(row.last_updated)}</TableCell>
                </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </section>
      </div>
    </main>
  )
}

function TvMetric({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: 'neutral' | 'emerald' | 'blue' | 'amber' }) {
  const toneClass =
    tone === 'emerald'
      ? 'text-emerald-300'
      : tone === 'blue'
        ? 'text-blue-300'
        : tone === 'amber'
          ? 'text-amber-300'
          : 'text-white'

  return (
    <Card className="border-neutral-800 bg-neutral-900 text-white">
      <CardContent className="p-5">
        <p className="text-sm font-medium uppercase tracking-normal text-neutral-400">{label}</p>
        <p className={`mt-3 text-5xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
      </CardContent>
    </Card>
  )
}
