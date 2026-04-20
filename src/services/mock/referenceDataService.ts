import employeesSeed from '../../../api/employees.json'
import jobPositionsSeed from '../../../api/jobPositions.json'
import leaveTypesSeed from '../../../api/leave-types.json'
import { delay } from './delay'
import type { Employee, JobPosition, LeaveType } from '@/types/leave'

export async function getEmployees (): Promise<Employee[]> {
  await delay()
  return structuredClone(employeesSeed) as Employee[]
}

export async function getJobPositions (): Promise<JobPosition[]> {
  await delay()
  return structuredClone(jobPositionsSeed) as JobPosition[]
}

export async function getLeaveTypes (): Promise<LeaveType[]> {
  await delay()
  return structuredClone(leaveTypesSeed) as LeaveType[]
}
