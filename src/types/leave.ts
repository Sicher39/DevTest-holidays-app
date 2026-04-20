export type LeaveRequestStatus = 'approved' | 'pending' | 'rejected'

export type LeaveType = {
  id: string
  label: string
}

export type Employee = {
  id: string
  firstName: string
  lastName: string
  email?: string
  jobPositionId: string
  placeId?: string
  annualLeaveAllowance?: number
  annualLeaveUsed?: number
  statusToday?: 'in_office' | 'on_leave' | 'remote'
}

export type JobPosition = {
  id: string
  name: string
}

export type LeaveRequest = {
  id: string
  employeeId: string
  type: string
  otherTypeDetail?: string | null
  startDate: string
  endDate: string
  days: number
  status: LeaveRequestStatus
  requestedAt: string
  updatedAt?: string
  approvedBy: string | null
  rejectionReason?: string | null
  note: string
}

export type CreateLeaveRequestInput = {
  employeeId: string
  type: string
  otherTypeDetail?: string | null
  startDate: string
  endDate: string
  note?: string | null
}

export type ReviewLeaveRequestInput = {
  status: Exclude<LeaveRequestStatus, 'pending'>
  rejectionReason?: string | null
}
