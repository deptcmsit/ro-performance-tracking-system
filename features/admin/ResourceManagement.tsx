'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import * as XLSX from 'xlsx'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { buildDailyRows, formatDateTime, formatTime, todayInColombo, statusClass } from '@/lib/portal'
import { createClient } from '@/supabase/client'
import { deleteAllocation, deleteRoute, saveAllocation, saveRoute } from '@/services/admin-actions'
import type { Allocation, Attendance, Route, User } from '@/types'
import { Download, FileSpreadsheet, Printer, Search, Trash2 } from 'lucide-react'

export function RouteManagement() {
  const [routes, setRoutes] = useState<Route[]>([])
  const [editing, setEditing] = useState<Route | null>(null)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const refresh = useCallback(async () => {
    const { data } = await createClient().from('routes').select('*').order('route_name')
    setRoutes((data || []) as Route[])
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function submit(formData: FormData) {
    startTransition(async () => {
      try {
        await saveRoute(formData)
        toast({ title: 'Route saved', type: 'success' })
        setEditing(null)
        await refresh()
      } catch (error) {
        toast({ title: 'Could not save route', description: error instanceof Error ? error.message : 'Unknown error', type: 'error' })
      }
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-neutral-500">Admin</p>
        <h1 className="text-2xl font-semibold tracking-tight">Route Management</h1>
      </div>
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{editing ? 'Edit route' : 'Create route'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={submit} className="space-y-4">
              <input type="hidden" name="id" value={editing?.id || ''} />
              <div className="grid gap-2">
                <Label htmlFor="route_name">Route name</Label>
                <Input id="route_name" name="route_name" defaultValue={editing?.route_name || ''} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Input id="description" name="description" defaultValue={editing?.description || ''} />
              </div>
              <div className="flex gap-2">
                <Button disabled={isPending}>{editing ? 'Save Route' : 'Create Route'}</Button>
                {editing && (
                  <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Routes</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routes.map((route) => (
                  <TableRow key={route.id}>
                    <TableCell className="font-medium">{route.route_name}</TableCell>
                    <TableCell>{route.description || '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setEditing(route)}>
                        Edit
                      </Button>
                      <Button
                        className="ml-2"
                        variant="destructive"
                        size="icon"
                        onClick={() => {
                          if (window.confirm(`Delete ${route.route_name}?`)) {
                            startTransition(async () => {
                              await deleteRoute(route.id)
                              await refresh()
                            })
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export function AllocationManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [editing, setEditing] = useState<Allocation | null>(null)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const recoveryOfficers = users.filter((user) => user.role === 'Recovery Officer')
  const userById = new Map(users.map((user) => [user.id, user]))

  const refresh = useCallback(async () => {
    const supabase = createClient()
    const [usersRes, allocationRes] = await Promise.all([
      supabase.from('users').select('*').order('employee_no'),
      supabase.from('allocations').select('*').order('allocation_name'),
    ])
    setUsers((usersRes.data || []) as User[])
    setAllocations((allocationRes.data || []) as Allocation[])
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function submit(formData: FormData) {
    startTransition(async () => {
      try {
        await saveAllocation(formData)
        toast({ title: 'Allocation saved', type: 'success' })
        setEditing(null)
        await refresh()
      } catch (error) {
        toast({ title: 'Could not save allocation', description: error instanceof Error ? error.message : 'Unknown error', type: 'error' })
      }
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-neutral-500">Admin</p>
        <h1 className="text-2xl font-semibold tracking-tight">Allocation Management</h1>
      </div>
      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{editing ? 'Edit allocation' : 'Assign allocation'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={submit} className="space-y-4">
              <input type="hidden" name="id" value={editing?.id || ''} />
              <div className="grid gap-2">
                <Label htmlFor="user_id">Recovery Officer</Label>
                <select
                  id="user_id"
                  name="user_id"
                  defaultValue={editing?.user_id || ''}
                  className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
                  required
                >
                  <option value="" disabled>
                    Select officer
                  </option>
                  {recoveryOfficers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.employee_no} - {user.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="allocation_name">Allocation</Label>
                  <Input id="allocation_name" name="allocation_name" defaultValue={editing?.allocation_name || ''} placeholder="BOC B1" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="allocation_code">Code</Label>
                  <Input id="allocation_code" name="allocation_code" defaultValue={editing?.allocation_code || ''} placeholder="BOC-001" required />
                </div>
              </div>
              <div className="flex gap-2">
                <Button disabled={isPending}>{editing ? 'Save Allocation' : 'Assign Allocation'}</Button>
                {editing && (
                  <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current allocations</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Allocation</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allocations.map((allocation) => {
                  const user = userById.get(allocation.user_id)
                  return (
                    <TableRow key={allocation.id}>
                      <TableCell className="font-medium">{user?.employee_no || '-'}</TableCell>
                      <TableCell>{user?.name || 'Unknown user'}</TableCell>
                      <TableCell>{allocation.allocation_name}</TableCell>
                      <TableCell>{allocation.allocation_code}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => setEditing(allocation)}>
                          Edit
                        </Button>
                        <Button
                          className="ml-2"
                          variant="destructive"
                          size="icon"
                          onClick={() => {
                            if (window.confirm(`Delete ${allocation.allocation_name}?`)) {
                              startTransition(async () => {
                                await deleteAllocation(allocation.id)
                                await refresh()
                              })
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export function Reports() {
  const [users, setUsers] = useState<User[]>([])
  const [routes, setRoutes] = useState<Route[]>([])
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [date, setDate] = useState(todayInColombo())
  const [query, setQuery] = useState('')

  const refresh = useCallback(async () => {
    const supabase = createClient()
    const [usersRes, routesRes, allocationsRes, attendanceRes] = await Promise.all([
      supabase.from('users').select('*').order('employee_no'),
      supabase.from('routes').select('*').order('route_name'),
      supabase.from('allocations').select('*').order('allocation_name'),
      supabase.from('attendance').select('*').eq('work_date', date),
    ])
    setUsers((usersRes.data || []) as User[])
    setRoutes((routesRes.data || []) as Route[])
    setAllocations((allocationsRes.data || []) as Allocation[])
    setAttendance((attendanceRes.data || []) as Attendance[])
  }, [date])

  useEffect(() => {
    refresh()
  }, [refresh])

  const rows = useMemo(() => {
    const needle = query.toLowerCase()
    return buildDailyRows(users, attendance, routes, allocations).filter((row) =>
      [row.employee_no, row.name, row.status, row.route_name || ''].some((item) => item.toLowerCase().includes(needle))
    )
  }, [users, attendance, routes, allocations, query])

  const exportRows = rows.map((row) => ({
    Date: date,
    Employee: row.employee_no,
    Name: row.name,
    Status: row.status,
    'Working Today': row.is_working_today === null ? 'No record' : row.is_working_today ? 'Yes' : 'No',
    Route: row.route_name,
    'Check In': formatTime(row.check_in_time),
    'Check Out': formatTime(row.check_out_time),
    Allocations: row.allocations.join(', '),
    'Last Updated': formatDateTime(row.last_updated),
  }))

  function downloadCsv() {
    const headers = Object.keys(exportRows[0] || { Date: '', Employee: '', Name: '', Status: '' })
    const csv = [
      headers.join(','),
      ...exportRows.map((row) => headers.map((header) => JSON.stringify(String(row[header as keyof typeof row] ?? ''))).join(',')),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ro-attendance-${date}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  function downloadExcel() {
    const sheet = XLSX.utils.json_to_sheet(exportRows)
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, sheet, 'Daily Attendance')
    XLSX.writeFile(book, `ro-attendance-${date}.xlsx`)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-medium text-neutral-500">Admin</p>
          <h1 className="text-2xl font-semibold tracking-tight">Attendance Reports</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={downloadCsv}>
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Button variant="outline" onClick={downloadExcel}>
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="grid gap-3 lg:grid-cols-[220px_1fr]">
          <div className="grid gap-2">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="search">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
              <Input id="search" className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, employee, status, route" />
            </div>
          </div>
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
                <TableHead>Check out</TableHead>
                <TableHead>Allocations</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.employee_no}>
                  <TableCell className="font-medium">{row.employee_no}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(row.status)}`}>{row.status}</span>
                  </TableCell>
                  <TableCell>{row.route_name}</TableCell>
                  <TableCell>{formatTime(row.check_in_time)}</TableCell>
                  <TableCell>{formatTime(row.check_out_time)}</TableCell>
                  <TableCell>{row.allocations.join(', ') || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
