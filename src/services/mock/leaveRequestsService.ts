import type {
  CreateLeaveRequestInput,
  Employee,
  LeaveRequest,
  LeaveType,
  ReviewLeaveRequestInput,
  UpdateLeaveRequestInput,
} from '@/types/leave'
import leaveRequestsSeed from '../../../api/leave-requests.json'
import { delay } from './delay'

const storageKey = 'holiday-app.leave-requests'
const dayInMilliseconds = 24 * 60 * 60 * 1000
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/

function parseIsoDate (value: string): Date | null {
  if (!isoDatePattern.test(value)) {
    return null
  }

  const [yearValue, monthValue, dayValue] = value.split('-').map(Number)
  const parsedDate = new Date(Date.UTC(yearValue, monthValue - 1, dayValue))

  if (
    parsedDate.getUTCFullYear() !== yearValue
    || parsedDate.getUTCMonth() !== monthValue - 1
    || parsedDate.getUTCDate() !== dayValue
  ) {
    return null
  }

  return parsedDate
}

function getCurrentDateString (): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function calculateInclusiveDayCount (startDate: string, endDate: string): number | null {
  const parsedStartDate = parseIsoDate(startDate)
  const parsedEndDate = parseIsoDate(endDate)

  if (!parsedStartDate || !parsedEndDate) {
    return null
  }

  const differenceInDays = Math.floor((parsedEndDate.getTime() - parsedStartDate.getTime()) / dayInMilliseconds) + 1

  if (differenceInDays <= 0) {
    return null
  }

  return differenceInDays
}

function readStoredLeaveRequests (): LeaveRequest[] {
  const rawValue = window.localStorage.getItem(storageKey)

  if (!rawValue) {
    const seedValue = structuredClone(leaveRequestsSeed) as LeaveRequest[]
    window.localStorage.setItem(storageKey, JSON.stringify(seedValue))
    return seedValue
  }

  try {
    return JSON.parse(rawValue) as LeaveRequest[]
  } catch {
    const fallbackValue = structuredClone(leaveRequestsSeed) as LeaveRequest[]
    window.localStorage.setItem(storageKey, JSON.stringify(fallbackValue))
    return fallbackValue
  }
}

function writeStoredLeaveRequests (value: LeaveRequest[]): void {
  window.localStorage.setItem(storageKey, JSON.stringify(value))
}

function createLeaveRequestId (existingRequests: LeaveRequest[]): string {
  const highestNumericId = existingRequests.reduce((highestValue, request) => {
    const match = /^req-(\d+)$/.exec(request.id)

    if (!match) {
      return highestValue
    }

    const numericValue = Number(match[1])

    if (!Number.isFinite(numericValue)) {
      return highestValue
    }

    return Math.max(highestValue, numericValue)
  }, 1000)

  return `req-${String(highestNumericId + 1).padStart(4, '0')}`
}

export async function getLeaveRequests (): Promise<LeaveRequest[]> {
  await delay()
  return structuredClone(readStoredLeaveRequests())
}

export async function createLeaveRequest (input: CreateLeaveRequestInput, employees: Employee[], leaveTypes: LeaveType[]): Promise<LeaveRequest> {
  await delay()

  const employeeExists = employees.some(employee => employee.id === input.employeeId)
  if (!employeeExists) {
    throw new Error('Zadaný zaměstnanec neexistuje.')
  }

  const leaveTypeExists = leaveTypes.some(leaveType => leaveType.id === input.type)
  if (!leaveTypeExists) {
    throw new Error('Zadaný typ dovolené neexistuje.')
  }

  const dayCount = calculateInclusiveDayCount(input.startDate, input.endDate)
  if (!dayCount) {
    throw new Error('Pole endDate musí být stejné nebo pozdější než startDate.')
  }

  const existingRequests = readStoredLeaveRequests()
  const currentDateString = getCurrentDateString()
  const nextRequest: LeaveRequest = {
    id: createLeaveRequestId(existingRequests),
    employeeId: input.employeeId,
    type: input.type,
    otherTypeDetail: input.type === 'other' ? (input.otherTypeDetail ?? null) : null,
    startDate: input.startDate,
    endDate: input.endDate,
    days: dayCount,
    status: 'pending',
    requestedAt: currentDateString,
    updatedAt: currentDateString,
    approvedBy: null,
    rejectionReason: null,
    note: input.note?.trim() ?? '',
  }

  writeStoredLeaveRequests([...existingRequests, nextRequest])
  return structuredClone(nextRequest)
}

export async function updateLeaveRequest (
  requestId: string,
  input: UpdateLeaveRequestInput,
  employees: Employee[],
  leaveTypes: LeaveType[],
): Promise<LeaveRequest> {
  await delay()

  const employeeExists = employees.some(employee => employee.id === input.employeeId)
  if (!employeeExists) {
    throw new Error('Zadaný zaměstnanec neexistuje.')
  }

  const leaveTypeExists = leaveTypes.some(leaveType => leaveType.id === input.type)
  if (!leaveTypeExists) {
    throw new Error('Zadaný typ dovolené neexistuje.')
  }

  const dayCount = calculateInclusiveDayCount(input.startDate, input.endDate)
  if (!dayCount) {
    throw new Error('Pole endDate musí být stejné nebo pozdější než startDate.')
  }

  if (input.status === 'rejected' && !input.rejectionReason?.trim()) {
    throw new Error('Pro zamítnutí je potřeba vyplnit důvod zamítnutí.')
  }

  const existingRequests = readStoredLeaveRequests()
  const requestIndex = existingRequests.findIndex(request => request.id === requestId)

  if (requestIndex === -1) {
    throw new Error('Požadovaná žádost nebyla nalezena.')
  }

  const currentRequest = existingRequests[requestIndex]
  const updatedRequest: LeaveRequest = {
    ...currentRequest,
    employeeId: input.employeeId,
    type: input.type,
    otherTypeDetail: input.type === 'other' ? (input.otherTypeDetail?.trim() ?? null) : null,
    startDate: input.startDate,
    endDate: input.endDate,
    days: dayCount,
    status: input.status,
    approvedBy: input.status === 'approved' ? (currentRequest.approvedBy ?? 'system') : null,
    rejectionReason: input.status === 'rejected' ? (input.rejectionReason?.trim() ?? null) : null,
    note: input.note?.trim() ?? '',
    updatedAt: getCurrentDateString(),
  }

  const nextRequests = [...existingRequests]
  nextRequests.splice(requestIndex, 1, updatedRequest)
  writeStoredLeaveRequests(nextRequests)

  return structuredClone(updatedRequest)
}

export async function reviewLeaveRequest (requestId: string, input: ReviewLeaveRequestInput): Promise<LeaveRequest> {
  await delay()

  if (input.status === 'rejected' && !input.rejectionReason?.trim()) {
    throw new Error('Pro zamítnutí je potřeba vyplnit důvod zamítnutí.')
  }

  const existingRequests = readStoredLeaveRequests()
  const requestIndex = existingRequests.findIndex(request => request.id === requestId)

  if (requestIndex === -1) {
    throw new Error('Požadovaná žádost nebyla nalezena.')
  }

  const currentRequest = existingRequests[requestIndex]
  const updatedRequest: LeaveRequest = {
    ...currentRequest,
    status: input.status,
    approvedBy: input.status === 'approved' ? (currentRequest.approvedBy ?? 'system') : null,
    rejectionReason: input.status === 'rejected' ? (input.rejectionReason?.trim() ?? null) : null,
    updatedAt: getCurrentDateString(),
  }

  const nextRequests = [...existingRequests]
  nextRequests.splice(requestIndex, 1, updatedRequest)
  writeStoredLeaveRequests(nextRequests)

  return structuredClone(updatedRequest)
}

export function resetLeaveRequestsStorage (): void {
  window.localStorage.removeItem(storageKey)
}
