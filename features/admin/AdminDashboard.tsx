'use client'

import Link from 'next/link'
import type { ElementType } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buildDailyRows, formatTime, statusClass, todayInColombo } from '@/lib/portal'
import { createClient } from '@/supabase/client'
import type { Allocation, Attendance, Route, User } from '@/types'
import { CalendarDays, ClipboardList, Map, Monitor, Users } from 'lucide-react'

export function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([])
  const [routes, setRoutes] = useState<Route[]>([])
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const supabase = createClient()
    const today = todayInColombo()
    const [usersRes, routesRes, allocationsRes, attendanceRes] = await Promise.all([
      supabase.from('users').select('*').order('employee_no', { ascending: true }),
      supabase.from('routes').select('*').order('route_name', { ascending: true }),
      supabase.from('allocations').select('*').order('allocation_name', { ascending: true }),
      supabase.from('attendance').select('*').eq('work_date', today),
    ])

    setUsers((usersRes.data || []) as User[])
    setRoutes((routesRes.data || []) as Route[])
    setAllocations((allocationsRes.data || []) as Allocation[])
    setAttendance((attendanceRes.data || []) as Attendance[])
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    const supabase = createClient()
    const channel = supabase
      .channel('admin-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'routes' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'allocations' }, refresh)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [refresh])

  const rows = useMemo(() => buildDailyRows(users, attendance, routes, allocations), [users, attendance, routes, allocations])
  const working = rows.filter((row) => row.status === 'Working').length
  const absent = rows.filter((row) => row.status === 'Absent').length
  const chartData = [
    { name: 'Working', total: working },
    { name: 'Absent', total: absent },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-medium text-neutral-500">Admin Dashboard</p>
          <h1 className="text-2xl font-semibold tracking-tight">Morning recovery operations</h1>
        </div>
        <Button asChild>
          <Link href="/sub-admin/dashboard">
            <Monitor className="h-4 w-4" />
            Open Live TV Mode
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard title="Total Users" value={users.length} icon={Users} />
        <SummaryCard title="Working Today" value={working} icon={Monitor} />
        <SummaryCard title="Absent Today" value={absent} icon={CalendarDays} />
        <SummaryCard title="Total Routes" value={routes.length} icon={Map} />
        <SummaryCard title="Allocations" value={allocations.length} icon={ClipboardList} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Today&apos;s live status</CardTitle>
            <Badge variant="outline">{todayInColombo()}</Badge>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Check in</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 12).map((row) => (
                  <TableRow key={row.employee_no}>
                    <TableCell className="font-medium">{row.employee_no}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(row.status)}`}>{row.status}</span>
                    </TableCell>
                    <TableCell>{row.route_name}</TableCell>
                    <TableCell>{formatTime(row.check_in_time)}</TableCell>
                  </TableRow>
                ))}
                {!loading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-neutral-500">
                      No recovery officers found. Run the Supabase seed script or create users.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status mix</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                  <Tooltip cursor={{ fill: 'rgba(115,115,115,0.08)' }} />
                  <Bar dataKey="total" radius={[6, 6, 0, 0]} fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <Button asChild variant="outline">
                <Link href="/admin/users">Manage ROs</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/admin/reports">Reports</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SummaryCard({ title, value, icon: Icon }: { title: string; value: number; icon: ElementType }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm text-neutral-500">{title}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
          <Icon className="h-5 w-5" />
        </span>
      </CardContent>
    </Card>
  )
}
