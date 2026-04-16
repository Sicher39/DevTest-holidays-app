import path from 'node:path'
import cors from 'cors'
import express, { type Request, type Response } from 'express'
import { JsonFileStore } from './lib/jsonFileStore.js'

type LeaveRequestStatus = 'approved' | 'pending' | 'rejected'

type LeaveRequestPayload = {
  employeeId: string
  type: string
  otherTypeDetail?: string | null
  startDate: string
  endDate: string
  note?: string
}

type ReviewLeaveRequestPayload = {
  status: Exclude<LeaveRequestStatus, 'pending'>
  rejectionReason?: string | null
}

type LeaveRequestRecord = {
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

type LeaveType = {
  id: string
  label: string
}

const app = express()
const port = Number(process.env.PORT ?? 4000)
const apiDirectoryPath = path.resolve(process.cwd(), 'api')
const jsonFileStore = new JsonFileStore(apiDirectoryPath)

const dayInMilliseconds = 24 * 60 * 60 * 1000
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/

app.use(cors())
app.use(express.json())

function sendInternalError (response: Response) {
  response.status(500).json({ message: 'Došlo k neočekávané chybě serveru.' })
}

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

const buildValidationError = (message: string) => ({ message })

function validatePayload (payload: unknown): LeaveRequestPayload | { message: string } {
  if (!payload || typeof payload !== 'object') {
    return buildValidationError('Neplatné tělo požadavku.')
  }

  const candidate = payload as Partial<LeaveRequestPayload>
  const normalizedEmployeeId = typeof candidate.employeeId === 'string' ? candidate.employeeId.trim() : ''
  const normalizedType = typeof candidate.type === 'string' ? candidate.type.trim() : ''

  if (!normalizedEmployeeId) {
    return buildValidationError('Pole employeeId je povinné a musí být text.')
  }

  if (!normalizedType) {
    return buildValidationError('Pole type je povinné a musí být text.')
  }

  if (typeof candidate.startDate !== 'string' || !parseIsoDate(candidate.startDate)) {
    return buildValidationError('Pole startDate musí mít formát YYYY-MM-DD.')
  }

  if (typeof candidate.endDate !== 'string' || !parseIsoDate(candidate.endDate)) {
    return buildValidationError('Pole endDate musí mít formát YYYY-MM-DD.')
  }

  if (candidate.note !== undefined && typeof candidate.note !== 'string') {
    return buildValidationError('Pole note musí být text.')
  }

  if (candidate.otherTypeDetail !== undefined && candidate.otherTypeDetail !== null && typeof candidate.otherTypeDetail !== 'string') {
    return buildValidationError('Pole otherTypeDetail musí být text, null nebo undefined.')
  }

  const normalizedOtherTypeDetail = typeof candidate.otherTypeDetail === 'string'
    ? candidate.otherTypeDetail.trim()
    : null

  if (normalizedType === 'other' && !normalizedOtherTypeDetail) {
    return buildValidationError('Pro typ other je potřeba vyplnit otherTypeDetail.')
  }

  return {
    employeeId: normalizedEmployeeId,
    type: normalizedType,
    otherTypeDetail: normalizedType === 'other' ? (normalizedOtherTypeDetail || null) : null,
    startDate: candidate.startDate,
    endDate: candidate.endDate,
    note: candidate.note?.trim() ?? '',
  }
}

function validateReviewPayload (payload: unknown): ReviewLeaveRequestPayload | { message: string } {
  if (!payload || typeof payload !== 'object') {
    return buildValidationError('Neplatné tělo požadavku.')
  }

  const candidate = payload as Partial<ReviewLeaveRequestPayload>
  const normalizedStatus = typeof candidate.status === 'string' ? candidate.status.trim() : ''

  if (normalizedStatus !== 'approved' && normalizedStatus !== 'rejected') {
    return buildValidationError('Pole status musí být approved nebo rejected.')
  }

  if (candidate.rejectionReason !== undefined && candidate.rejectionReason !== null && typeof candidate.rejectionReason !== 'string') {
    return buildValidationError('Pole rejectionReason musí být text, null nebo undefined.')
  }

  const normalizedRejectionReason = typeof candidate.rejectionReason === 'string'
    ? candidate.rejectionReason.trim()
    : null

  if (normalizedStatus === 'rejected' && !normalizedRejectionReason) {
    return buildValidationError('Pro zamítnutí je potřeba vyplnit rejectionReason.')
  }

  return {
    status: normalizedStatus,
    rejectionReason: normalizedStatus === 'rejected' ? normalizedRejectionReason : null,
  }
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

function createLeaveRequestId (existingRequests: LeaveRequestRecord[]): string {
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

  const nextValue = highestNumericId + 1

  return `req-${String(nextValue).padStart(4, '0')}`
}

app.get('/api/employees', async (_request, response) => {
  try {
    const employees = await jsonFileStore.readJsonFile('employees.json', [])
    response.json(employees)
  } catch {
    sendInternalError(response)
  }
})

app.get('/api/job-positions', async (_request, response) => {
  try {
    const jobPositions = await jsonFileStore.readJsonFile('jobPositions.json', [])
    response.json(jobPositions)
  } catch {
    sendInternalError(response)
  }
})

app.get('/api/leave-types', async (_request, response) => {
  try {
    const leaveTypes = await jsonFileStore.readJsonFile<LeaveType[]>('leave-types.json', [])
    response.json(leaveTypes)
  } catch {
    sendInternalError(response)
  }
})

app.get('/api/leave-requests', async (_request, response) => {
  try {
    const leaveRequests = await jsonFileStore.readJsonFile<LeaveRequestRecord[]>('leave-requests.json', [])
    response.json(leaveRequests)
  } catch {
    sendInternalError(response)
  }
})

app.post('/api/leave-requests', async (request: Request, response: Response) => {
  const validatedPayload = validatePayload(request.body)

  if ('message' in validatedPayload) {
    response.status(400).json(validatedPayload)
    return
  }

  const dayCount = calculateInclusiveDayCount(validatedPayload.startDate, validatedPayload.endDate)

  if (!dayCount) {
    response.status(400).json(buildValidationError('Pole endDate musí být stejné nebo pozdější než startDate.'))
    return
  }

  try {
    const [employees, leaveTypes] = await Promise.all([
      jsonFileStore.readJsonFile<Array<{ id: string }>>('employees.json', []),
      jsonFileStore.readJsonFile<LeaveType[]>('leave-types.json', []),
    ])

    const employeeExists = employees.some(employee => employee.id === validatedPayload.employeeId)

    if (!employeeExists) {
      response.status(400).json(buildValidationError('Zadané employeeId neexistuje.'))
      return
    }

    const leaveTypeExists = leaveTypes.some(leaveType => leaveType.id === validatedPayload.type)

    if (!leaveTypeExists) {
      response.status(400).json(buildValidationError('Zadaný type neexistuje.'))
      return
    }

    let createdRequest: LeaveRequestRecord | null = null

    await jsonFileStore.updateJsonFile<LeaveRequestRecord[]>('leave-requests.json', [], (existingRequests: LeaveRequestRecord[]) => {
      const currentDateString = getCurrentDateString()
      const nextRequest: LeaveRequestRecord = {
        id: createLeaveRequestId(existingRequests),
        employeeId: validatedPayload.employeeId,
        type: validatedPayload.type,
        otherTypeDetail: validatedPayload.type === 'other' ? (validatedPayload.otherTypeDetail ?? null) : null,
        startDate: validatedPayload.startDate,
        endDate: validatedPayload.endDate,
        days: dayCount,
        status: 'pending',
        requestedAt: currentDateString,
        updatedAt: currentDateString,
        approvedBy: null,
        rejectionReason: null,
        note: validatedPayload.note ?? '',
      }

      createdRequest = nextRequest

      return [...existingRequests, nextRequest]
    })

    if (!createdRequest) {
      sendInternalError(response)
      return
    }

    response.status(201).json(createdRequest)
  } catch {
    sendInternalError(response)
  }
})

app.patch('/api/leave-requests/:id/review', async (request: Request, response: Response) => {
  const validatedPayload = validateReviewPayload(request.body)

  if ('message' in validatedPayload) {
    response.status(400).json(validatedPayload)
    return
  }

  try {
    let updatedRequest: LeaveRequestRecord | null = null

    await jsonFileStore.updateJsonFile<LeaveRequestRecord[]>('leave-requests.json', [], existingRequests => {
      const requestIndex = existingRequests.findIndex(item => item.id === request.params.id)

      if (requestIndex === -1) {
        return existingRequests
      }

      const currentRequest = existingRequests[requestIndex]
      const nextRequest: LeaveRequestRecord = {
        ...currentRequest,
        status: validatedPayload.status,
        approvedBy: validatedPayload.status === 'approved' ? (currentRequest.approvedBy ?? 'system') : null,
        rejectionReason: validatedPayload.status === 'rejected' ? (validatedPayload.rejectionReason ?? null) : null,
        updatedAt: getCurrentDateString(),
      }

      updatedRequest = nextRequest

      const nextRequests = [...existingRequests]
      nextRequests.splice(requestIndex, 1, nextRequest)

      return nextRequests
    })

    if (!updatedRequest) {
      response.status(404).json(buildValidationError('Požadovaná žádost nebyla nalezena.'))
      return
    }

    response.json(updatedRequest)
  } catch {
    sendInternalError(response)
  }
})

app.listen(port, () => {
  console.log(`API server běží na http://localhost:${port}`)
})
