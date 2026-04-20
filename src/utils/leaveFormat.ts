import type { LeaveRequestStatus } from '@/types/leave'

const czechDateFormatter = new Intl.DateTimeFormat('cs-CZ')

export const leaveRequestStatusLabelsNoun: Record<LeaveRequestStatus, string> = {
  approved: 'Schváleno',
  pending: 'Čekající',
  rejected: 'Zamítnuto',
}

export const leaveRequestStatusLabelsAdjective: Record<LeaveRequestStatus, string> = {
  approved: 'Schválená',
  pending: 'Čekající',
  rejected: 'Zamítnutá',
}

const leaveRequestStatusColorByValue: Record<LeaveRequestStatus, 'success' | 'warning' | 'error'> = {
  approved: 'success',
  pending: 'warning',
  rejected: 'error',
}

export function formatDateToCzech (value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : czechDateFormatter.format(date)
}

export function getDateSortValue (value: string): number {
  const parsedDate = new Date(value).getTime()
  return Number.isNaN(parsedDate) ? Number.POSITIVE_INFINITY : parsedDate
}

export function getStatusChipColor (status: LeaveRequestStatus): 'success' | 'warning' | 'error' {
  return leaveRequestStatusColorByValue[status]
}
