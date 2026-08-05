'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import type { ElementType } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/supabase/client'
import { formatDateTime, formatTime, getStatus, todayInColombo } from '@/lib/portal'
import type { Allocation, Attendance, LocationUpdate, Route, User } from '@/types'
import { CheckCircle2, Clock, Crosshair, LogOut, MapPin, Navigation, Power, Route as RouteIcon, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function RoDashboard() {
  const [profile, setProfile] = useState<User | null>(null)
  const [attendance, setAttendance] = useState<Attendance | null>(null)
  const [routes, setRoutes] = useState<Route[]>([])
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [locations, setLocations] = useState<LocationUpdate[]>([])
  const [selectedRoute, setSelectedRoute] = useState('')
  const [locationNote, setLocationNote] = useState('')
  const [locationError, setLocationError] = useState('')
  const [locationTrackingReady, setLocationTrackingReady] = useState(true)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const refresh = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const today = todayInColombo()
    const [profileRes, routesRes, allocationsRes, attendanceRes, locationsRes] = await Promise.all([
      supabase.from('users').select('*').eq('id', user.id).single(),
      supabase.from('routes').select('*').order('route_name'),
      supabase.from('allocations').select('*').eq('user_id', user.id).order('allocation_name'),
      supabase.from('attendance').select('*').eq('user_id', user.id).eq('work_date', today).maybeSingle(),
      supabase.from('ro_locations').select('*').eq('user_id', user.id).eq('work_date', today).order('created_at', { ascending: false }).limit(8),
    ])

    setProfile(profileRes.data as User)
    setRoutes((routesRes.data || []) as Route[])
    setAllocations((allocationsRes.data || []) as Allocation[])
    setAttendance((attendanceRes.data || null) as Attendance | null)
    setLocations((locationsRes.data || []) as LocationUpdate[])
    setLocationTrackingReady(!locationsRes.error)
    setSelectedRoute((attendanceRes.data as Attendance | null)?.route_id || '')
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const routeById = useMemo(() => new Map(routes.map((route) => [route.id, route.route_name])), [routes])
  const status = getStatus(attendance)
  const needsRoute = attendance?.is_working_today && !attendance.route_id
  const latestLocation = locations[0]

  function run(action: () => Promise<void>) {
    startTransition(async () => {
      await action()
      await refresh()
    })
  }

  async function markWorking() {
    if (!profile) return
    const supabase = createClient()
    const { error } = await supabase.from('attendance').insert({
      user_id: profile.id,
      work_date: todayInColombo(),
      is_working_today: true,
      check_in_time: new Date().toISOString(),
      remarks: 'Checked in from RO portal',
    })
    if (error) throw new Error(error.message)
  }

  async function markAbsent() {
    if (!profile) return
    const supabase = createClient()
    const { error } = await supabase.from('attendance').insert({
      user_id: profile.id,
      work_date: todayInColombo(),
      is_working_today: false,
      remarks: 'Marked absent from RO portal',
    })
    if (error) throw new Error(error.message)
  }

  async function saveRoute() {
    if (!attendance || !selectedRoute) return
    const { error } = await createClient().from('attendance').update({ route_id: selectedRoute }).eq('id', attendance.id)
    if (error) throw new Error(error.message)
  }

  async function checkOut() {
    if (!attendance) return
    const { error } = await createClient()
      .from('attendance')
      .update({ check_out_time: new Date().toISOString(), remarks: 'Attendance completed from RO portal' })
      .eq('id', attendance.id)
    if (error) throw new Error(error.message)
  }

  function getBrowserPosition() {
    return new Promise<GeolocationPosition>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Location services are not available on this device.'))
        return
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        maximumAge: 15000,
        timeout: 20000,
      })
    })
  }

  async function updateLocation() {
    if (!profile || !attendance) return
    setLocationError('')

    try {
      const position = await getBrowserPosition()
      const { error } = await createClient().from('ro_locations').insert({
        user_id: profile.id,
        attendance_id: attendance.id,
        work_date: todayInColombo(),
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy_meters: position.coords.accuracy,
        note: locationNote.trim() || null,
      })
      if (error) throw new Error(error.message)
      setLocationNote('')
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : 'Could not capture location.')
    }
  }

  async function signOut() {
    await createClient().auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (loading) {
    return <div className="min-h-screen bg-neutral-50 p-6 dark:bg-neutral-950" />
  }

  return (
    <main className="min-h-screen bg-neutral-50 p-4 text-neutral-950 dark:bg-neutral-950 dark:text-white sm:p-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-neutral-500">{profile?.employee_no}</p>
            <h1 className="text-2xl font-semibold tracking-tight">Good morning, {profile?.name}</h1>
          </div>
          <Button variant="outline" size="icon" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </header>

        {!attendance && (
          <Card>
            <CardHeader>
              <CardTitle>Are you working today?</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Button className="h-20 text-lg" disabled={isPending} onClick={() => run(markWorking)}>
                <CheckCircle2 className="h-6 w-6" />
                YES
              </Button>
              <Button className="h-20 text-lg" variant="outline" disabled={isPending} onClick={() => run(markAbsent)}>
                <XCircle className="h-6 w-6" />
                NO
              </Button>
            </CardContent>
          </Card>
        )}

        {needsRoute && (
          <Card>
            <CardHeader>
              <CardTitle>Select today&apos;s route</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <select
                value={selectedRoute}
                onChange={(event) => setSelectedRoute(event.target.value)}
                className="h-11 rounded-md border border-neutral-200 bg-white px-3 text-sm shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
              >
                <option value="" disabled>
                  Choose route
                </option>
                {routes.map((route) => (
                  <option key={route.id} value={route.id}>
                    {route.route_name}
                  </option>
                ))}
              </select>
              <Button disabled={!selectedRoute || isPending} onClick={() => run(saveRoute)}>
                Save Route
              </Button>
            </CardContent>
          </Card>
        )}

        {attendance && !attendance.is_working_today && (
          <Card className="border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
            <CardContent className="p-6 text-center">
              <XCircle className="mx-auto h-12 w-12 text-neutral-400" />
              <h2 className="mt-4 text-xl font-semibold">You are marked as absent today.</h2>
              <p className="mt-1 text-sm text-neutral-500">Date: {todayInColombo()}</p>
            </CardContent>
          </Card>
        )}

        {attendance?.is_working_today && (
          <div className="grid gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle>Status</CardTitle>
                <Badge variant={status === 'Working' ? 'success' : 'secondary'}>{status}</Badge>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                <StatusTile icon={Clock} label="Check In Time" value={formatTime(attendance.check_in_time)} />
                <StatusTile icon={MapPin} label="Current Route" value={attendance.route_id ? routeById.get(attendance.route_id) || '-' : 'Pending'} />
                <StatusTile icon={Power} label="Check Out" value={formatTime(attendance.check_out_time)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Current Allocations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {allocations.map((allocation) => (
                    <Badge key={allocation.id} variant="outline" className="px-3 py-1.5 text-sm">
                      <RouteIcon className="mr-1 h-3.5 w-3.5" />
                      {allocation.allocation_name} ({allocation.allocation_code})
                    </Badge>
                  ))}
                  {allocations.length === 0 && <p className="text-sm text-neutral-500">No allocations assigned yet.</p>}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle>Location Updates</CardTitle>
                {latestLocation && (
                  <a
                    href={`https://www.google.com/maps?q=${latestLocation.latitude},${latestLocation.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-md border border-neutral-200 px-3 py-1.5 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-800 dark:hover:bg-neutral-900"
                  >
                    <Navigation className="h-4 w-4" />
                    Open Map
                  </a>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <input
                    value={locationNote}
                    onChange={(event) => setLocationNote(event.target.value)}
                    placeholder="Optional note, place, or landmark"
                    className="h-11 rounded-md border border-neutral-200 bg-white px-3 text-sm shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
                  />
                  <Button disabled={isPending || !attendance.route_id || !locationTrackingReady} onClick={() => run(updateLocation)}>
                    <Crosshair className="h-4 w-4" />
                    Update Location
                  </Button>
                </div>

                {!locationTrackingReady && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                    Location tracking database table is not active yet. Run supabase/location-upgrade.sql once in Supabase.
                  </div>
                )}

                {locationError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                    {locationError}
                  </div>
                )}

                {latestLocation ? (
                  <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
                    <p className="text-xs font-medium uppercase tracking-normal text-neutral-500">Current Location</p>
                    <p className="mt-1 text-sm font-semibold">{formatDateTime(latestLocation.created_at)}</p>
                    <p className="mt-1 text-sm text-neutral-500">
                      Accuracy: {latestLocation.accuracy_meters ? `${Math.round(latestLocation.accuracy_meters)}m` : '-'}
                    </p>
                    {latestLocation.note && <p className="mt-2 text-sm">{latestLocation.note}</p>}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500">No location update sent yet today.</p>
                )}

                {locations.length > 1 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-normal text-neutral-500">Past Locations Today</p>
                    {locations.slice(1).map((location) => (
                      <a
                        key={location.id}
                        href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-800 dark:hover:bg-neutral-900"
                      >
                        <span>{formatDateTime(location.created_at)}</span>
                        <span className="text-neutral-500">{location.note || 'Map'}</span>
                      </a>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {!attendance.check_out_time && (
              <Button className="h-16 text-lg" disabled={isPending || !attendance.route_id} onClick={() => run(checkOut)}>
                <Power className="h-5 w-5" />
                Check Out
              </Button>
            )}
          </div>
        )}
      </div>
    </main>
  )
}

function StatusTile({ icon: Icon, label, value }: { icon: ElementType; label: string; value?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <Icon className="h-5 w-5 text-neutral-500" />
      <p className="mt-3 text-xs font-medium uppercase tracking-normal text-neutral-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value || '-'}</p>
    </div>
  )
}
