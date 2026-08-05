export type UserRole = 'Admin' | 'Sub Admin' | 'Recovery Officer'

export interface User {
  id: string
  name: string
  employee_no: string | null
  phone: string | null
  email: string
  role: UserRole
  active: boolean
  created_at: string
}

export interface Route {
  id: string
  route_name: string
  description: string | null
  created_at: string
}

export interface Allocation {
  id: string
  user_id: string
  allocation_name: string
  allocation_code: string
  created_at: string
}

export interface Attendance {
  id: string
  user_id: string
  work_date: string
  is_working_today: boolean
  check_in_time: string | null
  check_out_time: string | null
  route_id: string | null
  remarks: string | null
  created_at: string
  updated_at?: string
  
  // Joined relations (optional)
  users?: User
  routes?: Route
}

export interface LocationUpdate {
  id: string
  user_id: string
  attendance_id: string | null
  work_date: string
  latitude: number
  longitude: number
  accuracy_meters: number | null
  note: string | null
  created_at: string
}

export interface DailyAttendanceRow {
  user_id: string
  employee_no: string
  name: string
  role: string
  is_working_today: boolean | null
  route_name: string | null
  check_in_time: string | null
  check_out_time: string | null
  allocations: string[]
  remarks: string | null
  last_updated: string
  status: 'Working' | 'Absent'
}
