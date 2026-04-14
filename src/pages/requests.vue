<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import MainRow from '@/components/MainRow.vue'
  import PageHeader from '@/components/PageHeader.vue'

  type LeaveRequestStatus = 'approved' | 'pending' | 'rejected'
  type StatusFilterValue = 'all' | LeaveRequestStatus

  type LeaveRequest = {
    id: string
    employeeId: string
    type: string
    startDate: string
    endDate: string
    status: LeaveRequestStatus
  }

  type Employee = {
    id: string
    firstName: string
    lastName: string
    jobPositionId: string
  }

  type JobPosition = {
    id: string
    name: string
  }

  type VacationRequestRow = {
    id: string
    employeeName: string
    workplace: string
    startDate: string
    endDate: string
    startDateValue: number
    endDateValue: number
    status: LeaveRequestStatus | 'unknown'
    statusLabel: string
  }

  type RequestTableHeaderKey = keyof Pick<VacationRequestRow, 'employeeName' | 'workplace' | 'startDateValue' | 'endDateValue' | 'statusLabel'>
  type RequestTableSortOrder = 'asc' | 'desc'
  type RequestTableSortItem = {
    key: RequestTableHeaderKey
    order?: RequestTableSortOrder
  }

  const safeUnknownEmployee = 'Neznámý zaměstnanec'
  const safeUnknownWorkplace = 'Neznámé pracoviště'
  const safeUnknownStatus = 'Neznámý stav'

  const dateFormatter = new Intl.DateTimeFormat('cs-CZ')

  const employees = ref<Employee[]>([])
  const jobPositions = ref<JobPosition[]>([])
  const leaveRequests = ref<LeaveRequest[]>([])

  const search = ref('')
  const statusFilter = ref<StatusFilterValue>('all')
  const requestTableSortBy = ref<RequestTableSortItem[]>([
    {
      key: 'employeeName',
      order: 'asc',
    },
  ])

  const requestTableHeaders: { title: string, key: RequestTableHeaderKey, align?: 'start' | 'center' | 'end' }[] = [
    { title: 'Příjmení a jméno', key: 'employeeName' },
    { title: 'Pracoviště', key: 'workplace' },
    { title: 'Dovolená od', key: 'startDateValue' },
    { title: 'Dovolená do', key: 'endDateValue' },
    { title: 'Stav žádosti', key: 'statusLabel', align: 'center' },
  ]

  const statusFilterItems: { title: string, value: StatusFilterValue }[] = [
    { title: 'Všechny stavy', value: 'all' },
    { title: 'Čekající', value: 'pending' },
    { title: 'Schválené', value: 'approved' },
    { title: 'Zamítnuté', value: 'rejected' },
  ]

  const statusLabelByValue: Record<LeaveRequestStatus, string> = {
    approved: 'Schváleno',
    pending: 'Čekající',
    rejected: 'Zamítnuto',
  }

  function formatDate (dateString: string): string {
    const date = new Date(dateString)

    if (Number.isNaN(date.getTime())) {
      return dateString
    }

    return dateFormatter.format(date)
  }

  function getStatusChipColor (status: VacationRequestRow['status']): string {
    if (status === 'pending') {
      return 'amber-darken-2'
    }

    if (status === 'approved') {
      return 'green-darken-1'
    }

    if (status === 'rejected') {
      return 'red-darken-1'
    }

    return 'grey-darken-1'
  }

  async function fetchApiJson<T> (url: string): Promise<T | null> {
    try {
      const response = await fetch(url)

      if (!response.ok) {
        return null
      }

      return await response.json() as T
    } catch {
      return null
    }
  }

  async function loadVacationRequests (): Promise<void> {
    const [employeesResponse, leaveRequestsResponse, jobPositionsResponse] = await Promise.all([
      fetchApiJson<Employee[]>('/api/employees'),
      fetchApiJson<LeaveRequest[]>('/api/leave-requests'),
      fetchApiJson<JobPosition[]>('/api/job-positions'),
    ])

    employees.value = employeesResponse ?? []
    leaveRequests.value = leaveRequestsResponse ?? []
    jobPositions.value = jobPositionsResponse ?? []
  }

  const employeeById = computed(() => {
    return new Map(employees.value.map(employee => [employee.id, employee]))
  })

  const workplaceById = computed(() => {
    return new Map(jobPositions.value.map(position => [position.id, position.name]))
  })

  const vacationRequestRows = computed<VacationRequestRow[]>(() => {
    return leaveRequests.value
      .filter(request => request.type === 'vacation')
      .map(request => {
        const employee = employeeById.value.get(request.employeeId)

        const employeeName = employee
          ? `${employee.lastName} ${employee.firstName}`
          : safeUnknownEmployee

        const workplace = employee
          ? (workplaceById.value.get(employee.jobPositionId) ?? safeUnknownWorkplace)
          : safeUnknownWorkplace

        const startDateValue = new Date(request.startDate).getTime()
        const endDateValue = new Date(request.endDate).getTime()

        return {
          id: request.id,
          employeeName,
          workplace,
          startDate: formatDate(request.startDate),
          endDate: formatDate(request.endDate),
          startDateValue: Number.isNaN(startDateValue) ? Number.POSITIVE_INFINITY : startDateValue,
          endDateValue: Number.isNaN(endDateValue) ? Number.POSITIVE_INFINITY : endDateValue,
          status: request.status,
          statusLabel: statusLabelByValue[request.status] ?? safeUnknownStatus,
        }
      })
  })

  const filteredVacationRequestRows = computed(() => {
    const query = search.value.trim().toLocaleLowerCase()

    return vacationRequestRows.value.filter(request => {
      const matchesStatus = statusFilter.value === 'all' || request.status === statusFilter.value

      if (!matchesStatus) {
        return false
      }

      if (!query) {
        return true
      }

      return [request.employeeName, request.workplace]
        .join(' ')
        .toLocaleLowerCase()
        .includes(query)
    })
  })

  onMounted(() => {
    void loadVacationRequests()
  })
</script>

<template>
  <PageHeader title="Všechny žádosti o dovolenou" />
  <MainRow>
    <v-card class="mt-6 w-full" flat>
      <v-card-title class="flex items-center justify-between flex-wrap gap-4">
        <span class="text-h6 uppercase px-2">Seznam dovolených žádostí</span>

        <div class="requests-filter-bar flex items-center gap-2 flex-wrap">
          <v-select
            v-model="statusFilter"
            class="requests-filter-select my-2"
            density="compact"
            hide-details
            :items="statusFilterItems"
            variant="outlined"
            label="Stav žádosti"
          />

          <v-text-field
            v-model="search"
            class="requests-search-field my-2"
            density="compact"
            hide-details
            label="Vyhledat zaměstnance nebo pracoviště"
            prepend-inner-icon="mdi-magnify"
            variant="outlined"
          />
        </div>
      </v-card-title>

      <v-divider />

      <v-data-table
        v-model:sort-by="requestTableSortBy"
        class="w-full"
        :headers="requestTableHeaders"
        hide-default-footer
        :items="filteredVacationRequestRows"
        :items-per-page="-1"
        no-data-text="Nebyly nalezeny žádné žádosti o dovolenou."
      >
        <template #item.startDateValue="{ item }">
          {{ item.startDate }}
        </template>

        <template #item.endDateValue="{ item }">
          {{ item.endDate }}
        </template>

        <template #item.statusLabel="{ item }">
          <div class="flex justify-center">
            <v-chip
              class="min-w-[120px] px-2 justify-center"
              :color="getStatusChipColor(item.status)"
              size="small"
              variant="flat"
            >
              {{ item.statusLabel }}
            </v-chip>
          </div>
        </template>
      </v-data-table>
    </v-card>
  </MainRow>
</template>

<style scoped>
  .requests-filter-select {
    width: min(100%, 220px);
  }

  .requests-search-field {
    width: min(100%, 320px);
  }

  @media (max-width: 839px) {
    .requests-filter-bar {
      width: 100%;
    }

    .requests-filter-select,
    .requests-search-field {
      width: 100%;
    }
  }
</style>
