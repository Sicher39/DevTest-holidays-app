import type { Employee, LeaveRequest, LeaveType } from '@/types/leave'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import employeesSeed from '../../../api/employees.json'
import leaveRequestsSeed from '../../../api/leave-requests.json'
import leaveTypesSeed from '../../../api/leave-types.json'
import {
  createLeaveRequest,
  getLeaveRequests,
  resetLeaveRequestsStorage,
  updateLeaveRequest,
} from './leaveRequestsService'

vi.mock('./delay', () => ({
  delay: () => Promise.resolve(),
}))

const employees = structuredClone(employeesSeed) as Employee[]
const leaveTypes = structuredClone(leaveTypesSeed) as LeaveType[]
const leaveRequests = structuredClone(leaveRequestsSeed) as LeaveRequest[]

describe('leaveRequestsService', () => {
  beforeEach(() => {
    vi.useRealTimers()
    window.localStorage.clear()
    resetLeaveRequestsStorage()
  })

  it('creates a new leave request with note and other leave detail', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-22T12:00:00Z'))

    const createdRequest = await createLeaveRequest({
      employeeId: employees[0].id,
      type: 'other',
      otherTypeDetail: 'Studijní volno',
      startDate: '2026-05-12',
      endDate: '2026-05-14',
      note: ' Nutné kvůli obhajobě. ',
    }, employees, leaveTypes)

    expect(createdRequest.id).toMatch(/^req-\d+$/)
    expect(createdRequest.status).toBe('pending')
    expect(createdRequest.days).toBe(3)
    expect(createdRequest.note).toBe('Nutné kvůli obhajobě.')
    expect(createdRequest.type).toBe('other')
    expect(createdRequest.otherTypeDetail).toBe('Studijní volno')
    expect(createdRequest.requestedAt).toBe('2026-04-22')
    expect(createdRequest.updatedAt).toBe('2026-04-22')

    const storedRequests = await getLeaveRequests()
    expect(storedRequests).toContainEqual(createdRequest)
  })

  it('updates an existing leave request including other leave detail and note', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-25T09:00:00Z'))
    window.localStorage.setItem('holiday-app.leave-requests', JSON.stringify(leaveRequests))

    const targetRequest = leaveRequests[0]
    const updatedRequest = await updateLeaveRequest(
      targetRequest.id,
      {
        employeeId: targetRequest.employeeId,
        type: 'other',
        otherTypeDetail: 'Ředitelské volno',
        startDate: '2026-06-10',
        endDate: '2026-06-12',
        note: ' Upravená poznámka ',
        status: 'approved',
      },
      employees,
      leaveTypes,
    )

    expect(updatedRequest.type).toBe('other')
    expect(updatedRequest.otherTypeDetail).toBe('Ředitelské volno')
    expect(updatedRequest.startDate).toBe('2026-06-10')
    expect(updatedRequest.endDate).toBe('2026-06-12')
    expect(updatedRequest.days).toBe(3)
    expect(updatedRequest.note).toBe('Upravená poznámka')
    expect(updatedRequest.status).toBe('approved')
    expect(updatedRequest.approvedBy).toBe(targetRequest.approvedBy ?? 'system')
    expect(updatedRequest.updatedAt).toBe('2026-04-25')

    const storedRequests = await getLeaveRequests()
    expect(storedRequests.find(request => request.id === targetRequest.id)).toEqual(updatedRequest)
  })

  it('rejects update when rejected status has no reason', async () => {
    window.localStorage.setItem('holiday-app.leave-requests', JSON.stringify(leaveRequests))

    await expect(updateLeaveRequest(
      leaveRequests[0].id,
      {
        employeeId: leaveRequests[0].employeeId,
        type: leaveRequests[0].type,
        startDate: leaveRequests[0].startDate,
        endDate: leaveRequests[0].endDate,
        note: leaveRequests[0].note,
        status: 'rejected',
        rejectionReason: '   ',
      },
      employees,
      leaveTypes,
    )).rejects.toThrow('Pro zamítnutí je potřeba vyplnit důvod zamítnutí.')
  })
})
