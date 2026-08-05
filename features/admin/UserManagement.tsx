'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { createClient } from '@/supabase/client'
import { deleteUser, resetUserPassword, saveUser, setUserActive } from '@/services/admin-actions'
import type { User, UserRole } from '@/types'
import { Edit, KeyRound, Plus, Power, Search, Trash2 } from 'lucide-react'

const roleOptions: UserRole[] = ['Admin', 'Sub Admin', 'Recovery Officer']

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<User | null>(null)
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const refresh = useCallback(async () => {
    const { data } = await createClient().from('users').select('*').order('employee_no', { ascending: true })
    setUsers((data || []) as User[])
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const filtered = useMemo(() => {
    const needle = query.toLowerCase()
    return users.filter((user) =>
      [user.name, user.employee_no || '', user.email, user.role].some((item) => item.toLowerCase().includes(needle))
    )
  }, [users, query])

  async function submit(formData: FormData) {
    startTransition(async () => {
      try {
        await saveUser(formData)
        toast({ title: 'User saved', type: 'success' })
        setOpen(false)
        setEditing(null)
        await refresh()
      } catch (error) {
        toast({ title: 'Could not save user', description: error instanceof Error ? error.message : 'Unknown error', type: 'error' })
      }
    })
  }

  function runAction(action: () => Promise<unknown>, success: string) {
    startTransition(async () => {
      try {
        await action()
        toast({ title: success, type: 'success' })
        await refresh()
      } catch (error) {
        toast({ title: 'Action failed', description: error instanceof Error ? error.message : 'Unknown error', type: 'error' })
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-medium text-neutral-500">Admin</p>
          <h1 className="text-2xl font-semibold tracking-tight">Recovery Officer Management</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}>
              <Plus className="h-4 w-4" />
              Create User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? 'Update user' : 'Create user'}</DialogTitle>
              <DialogDescription>Admin, Sub Admin, and Recovery Officer accounts are created in Supabase Auth.</DialogDescription>
            </DialogHeader>
            <form action={submit} className="grid gap-4">
              <input type="hidden" name="id" value={editing?.id || ''} />
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" defaultValue={editing?.name || ''} required />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="employee_no">Employee No</Label>
                  <Input id="employee_no" name="employee_no" defaultValue={editing?.employee_no || ''} placeholder="RO031" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" defaultValue={editing?.phone || ''} placeholder="0771234567" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email / username email</Label>
                <Input id="email" name="email" type="email" defaultValue={editing?.email || ''} placeholder="ro031@ro-tracking.com" required />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="role">Role</Label>
                  <select
                    id="role"
                    name="role"
                    defaultValue={editing?.role || 'Recovery Officer'}
                    className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
                  >
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="active">Status</Label>
                  <select
                    id="active"
                    name="active"
                    defaultValue={editing?.active === false ? 'false' : 'true'}
                    className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">{editing ? 'New password (optional)' : 'Password'}</Label>
                <Input id="password" name="password" type="password" placeholder={editing ? 'Leave blank to keep current password' : 'PazzyRO123'} />
              </div>
              <Button disabled={isPending}>{editing ? 'Save Changes' : 'Create User'}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Users</CardTitle>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
            <Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, employee, email" />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.employee_no || '-'}</TableCell>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.role}</TableCell>
                  <TableCell>
                    <Badge variant={user.active ? 'success' : 'secondary'}>{user.active ? 'Active' : 'Inactive'}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="icon" title="Edit user" onClick={() => { setEditing(user); setOpen(true) }}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        title="Reset password"
                        onClick={() => {
                          const password = window.prompt('Enter the new password')
                          if (password) runAction(() => resetUserPassword(user.id, password), 'Password reset')
                        }}
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        title={user.active ? 'Deactivate user' : 'Activate user'}
                        onClick={() => runAction(() => setUserActive(user.id, !user.active), user.active ? 'User deactivated' : 'User activated')}
                      >
                        <Power className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        title="Delete user"
                        onClick={() => {
                          if (window.confirm(`Delete ${user.name}?`)) runAction(() => deleteUser(user.id), 'User deleted')
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
