'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient, createClient } from '@/supabase/server'
import type { UserRole } from '@/types'

const roles = ['Admin', 'Sub Admin', 'Recovery Officer'] as const

const userSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'Name is required'),
  employee_no: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Valid email is required'),
  password: z.string().optional(),
  role: z.enum(roles),
  active: z.boolean(),
})

const routeSchema = z.object({
  id: z.string().optional(),
  route_name: z.string().min(2, 'Route name is required'),
  description: z.string().optional(),
})

const allocationSchema = z.object({
  id: z.string().optional(),
  user_id: z.string().uuid('Select a recovery officer'),
  allocation_name: z.string().min(2, 'Allocation name is required'),
  allocation_code: z.string().min(2, 'Allocation code is required'),
})

function value(formData: FormData, key: string) {
  const item = formData.get(key)
  return typeof item === 'string' ? item.trim() : ''
}

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user?.user_metadata?.role !== 'Admin') {
    throw new Error('Admin access required.')
  }
}

function revalidateAdmin() {
  revalidatePath('/admin/dashboard')
  revalidatePath('/admin/users')
  revalidatePath('/admin/routes')
  revalidatePath('/admin/allocations')
  revalidatePath('/admin/reports')
  revalidatePath('/sub-admin/dashboard')
}

export async function saveUser(formData: FormData) {
  await requireAdmin()

  const parsed = userSchema.parse({
    id: value(formData, 'id') || undefined,
    name: value(formData, 'name'),
    employee_no: value(formData, 'employee_no') || undefined,
    phone: value(formData, 'phone') || undefined,
    email: value(formData, 'email').toLowerCase(),
    password: value(formData, 'password') || undefined,
    role: value(formData, 'role') as UserRole,
    active: formData.get('active') !== 'false',
  })

  const admin = await createAdminClient()
  const metadata = {
    name: parsed.name,
    employee_no: parsed.employee_no || '',
    phone: parsed.phone || '',
    role: parsed.role,
    active: parsed.active,
  }

  if (parsed.id) {
    const { error } = await admin.auth.admin.updateUserById(parsed.id, {
      email: parsed.email,
      password: parsed.password || undefined,
      user_metadata: metadata,
    })
    if (error) throw new Error(error.message)

    const { error: profileError } = await admin
      .from('users')
      .update({
        name: parsed.name,
        employee_no: parsed.employee_no || null,
        phone: parsed.phone || null,
        email: parsed.email,
        role: parsed.role,
        active: parsed.active,
      })
      .eq('id', parsed.id)
    if (profileError) throw new Error(profileError.message)
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: parsed.email,
      password: parsed.password || 'PazzyRO123',
      email_confirm: true,
      user_metadata: metadata,
    })
    if (error) throw new Error(error.message)
    if (!data.user) throw new Error('User was not created.')

    const { error: profileError } = await admin.from('users').upsert({
      id: data.user.id,
      name: parsed.name,
      employee_no: parsed.employee_no || null,
      phone: parsed.phone || null,
      email: parsed.email,
      role: parsed.role,
      active: parsed.active,
    })
    if (profileError) throw new Error(profileError.message)
  }

  revalidateAdmin()
  return { ok: true }
}

export async function deleteUser(userId: string) {
  await requireAdmin()
  const admin = await createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) throw new Error(error.message)
  revalidateAdmin()
  return { ok: true }
}

export async function resetUserPassword(userId: string, password: string) {
  await requireAdmin()
  if (password.length < 8) throw new Error('Password must be at least 8 characters.')

  const admin = await createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(userId, { password })
  if (error) throw new Error(error.message)
  return { ok: true }
}

export async function setUserActive(userId: string, active: boolean) {
  await requireAdmin()
  const admin = await createAdminClient()
  const { data, error: readError } = await admin.from('users').select('*').eq('id', userId).single()
  if (readError) throw new Error(readError.message)

  const { error } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: {
      name: data.name,
      employee_no: data.employee_no || '',
      phone: data.phone || '',
      role: data.role,
      active,
    },
  })
  if (error) throw new Error(error.message)

  const { error: profileError } = await admin.from('users').update({ active }).eq('id', userId)
  if (profileError) throw new Error(profileError.message)
  revalidateAdmin()
  return { ok: true }
}

export async function saveRoute(formData: FormData) {
  await requireAdmin()
  const parsed = routeSchema.parse({
    id: value(formData, 'id') || undefined,
    route_name: value(formData, 'route_name'),
    description: value(formData, 'description') || undefined,
  })

  const admin = await createAdminClient()
  const query = parsed.id
    ? admin.from('routes').update({ route_name: parsed.route_name, description: parsed.description || null }).eq('id', parsed.id)
    : admin.from('routes').insert({ route_name: parsed.route_name, description: parsed.description || null })

  const { error } = await query
  if (error) throw new Error(error.message)
  revalidateAdmin()
  return { ok: true }
}

export async function deleteRoute(routeId: string) {
  await requireAdmin()
  const admin = await createAdminClient()
  const { error } = await admin.from('routes').delete().eq('id', routeId)
  if (error) throw new Error(error.message)
  revalidateAdmin()
  return { ok: true }
}

export async function saveAllocation(formData: FormData) {
  await requireAdmin()
  const parsed = allocationSchema.parse({
    id: value(formData, 'id') || undefined,
    user_id: value(formData, 'user_id'),
    allocation_name: value(formData, 'allocation_name'),
    allocation_code: value(formData, 'allocation_code'),
  })

  const admin = await createAdminClient()
  const query = parsed.id
    ? admin
        .from('allocations')
        .update({
          user_id: parsed.user_id,
          allocation_name: parsed.allocation_name,
          allocation_code: parsed.allocation_code,
        })
        .eq('id', parsed.id)
    : admin.from('allocations').insert({
        user_id: parsed.user_id,
        allocation_name: parsed.allocation_name,
        allocation_code: parsed.allocation_code,
      })

  const { error } = await query
  if (error) throw new Error(error.message)
  revalidateAdmin()
  return { ok: true }
}

export async function deleteAllocation(allocationId: string) {
  await requireAdmin()
  const admin = await createAdminClient()
  const { error } = await admin.from('allocations').delete().eq('id', allocationId)
  if (error) throw new Error(error.message)
  revalidateAdmin()
  return { ok: true }
}
