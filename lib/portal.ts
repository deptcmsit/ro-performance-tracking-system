import type { Attendance, Allocation, DailyAttendanceRow, Route, User } from '@/types'

export function todayInColombo() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function formatTime(value?: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-LK', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Colombo',
  }).format(new Date(value))
}

export function formatDateTime(value?: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-LK', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Colombo',
  }).format(new Date(value))
}

export function getStatus(attendance?: Attendance | null) {
  if (!attendance) return 'Absent'
  if (!attendance.is_working_today) return 'Absent'
  return 'Working'
}

export function buildDailyRows(
  users: User[],
  attendance: Attendance[],
  routes: Route[],
  allocations: Allocation[]
): DailyAttendanceRow[] {
  const attendanceByUser = new Map(attendance.map((item) => [item.user_id, item]))
  const routeById = new Map(routes.map((route) => [route.id, route.route_name]))

  return users
    .filter((user) => user.role === 'Recovery Officer')
    .map((user) => {
      const record = attendanceByUser.get(user.id)
      const status = getStatus(record)
      return {
        user_id: user.id,
        employee_no: user.employee_no || '-',
        name: user.name,
        role: user.role,
        is_working_today: record?.is_working_today ?? null,
        route_name: record?.route_id ? routeById.get(record.route_id) || '-' : '-',
        check_in_time: record?.check_in_time || null,
        check_out_time: record?.check_out_time || null,
        allocations: allocations
          .filter((allocation) => allocation.user_id === user.id)
          .map((allocation) => allocation.allocation_name),
        remarks: record?.remarks || null,
        last_updated: record?.updated_at || record?.created_at || user.created_at,
        status,
      }
    })
}

export function statusClass(status: DailyAttendanceRow['status']) {
  if (status === 'Working') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
  return 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200'
}
