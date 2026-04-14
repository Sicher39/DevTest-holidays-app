<script setup lang="ts">
  import { computed, onMounted, ref, watch } from 'vue'
  import MainRow from '@/components/MainRow.vue'
  import PageHeader from '@/components/PageHeader.vue'

  type DashboardCard = {
    title: 'V kanceláři' | 'Na dovolené' | 'Remote'
    value: number
  }

  type LeaveRequestStatus = 'approved' | 'pending' | 'rejected'
  type EmployeeStatusToday = 'in_office' | 'on_leave' | 'remote'
  type ReviewAction = 'approved' | 'rejected'

  type LeaveRequest = {
    id: string
    employeeId: string
    startDate: string
    endDate: string
    status: LeaveRequestStatus
    rejectionReason?: string | null
  }

  type Employee = {
    id: string
    firstName: string
    lastName: string
    jobPositionId: string
    statusToday?: EmployeeStatusToday
  }

  type JobPosition = {
    id: string
    name: string
  }

  type PendingRequestRow = {
    id: string
    employeeName: string
    workplace: string
    startDate: string
    endDate: string
    startDateSort: number
    endDateSort: number
    statusLabel: string
    statusRaw: LeaveRequestStatus
    rejectionReason?: string | null
  }

  const employees = ref<Employee[]>([])
  const jobPositions = ref<JobPosition[]>([])
  const leaveRequests = ref<LeaveRequest[]>([])

  const searchPendingRequests = ref('')
  const reviewDialogVisible = ref(false)
  const reviewAction = ref<ReviewAction | null>(null)
  const rejectionReason = ref('')
  const selectedRequestId = ref<string | null>(null)

  const itemsPerPageOptions = [5, 10, 20]
  const itemsPerPage = ref(10)
  const currentPage = ref(1)

  const safeUnknownEmployee = 'Neznámý zaměstnanec'
  const safeUnknownWorkplace = 'Neznámé pracoviště'

  const pendingRequestTableHeaders = [
    { title: 'Příjmení a jméno', key: 'employeeName', sortable: true },
    { title: 'Pracoviště', key: 'workplace', sortable: true },
    { title: 'Dovolená od', key: 'startDateSort', sortable: true },
    { title: 'Dovolená do', key: 'endDateSort', sortable: true },
    {
      title: 'Stav žádosti',
      key: 'statusRaw',
      sortable: true,
      width: '1%',
      cellProps: { class: 'dashboard-col-status' },
      headerProps: { class: 'dashboard-col-status' },
    },
    {
      title: 'Posouzení',
      key: 'review',
      sortable: false,
      align: 'start' as const,
      width: '1%',
      cellProps: { class: 'dashboard-col-review' },
      headerProps: { class: 'dashboard-col-review' },
    },
  ]

  const summaryCards = computed<DashboardCard[]>(() => {
    const inOfficeCount = employees.value.filter(employee => employee.statusToday === 'in_office').length
    const onLeaveCount = employees.value.filter(employee => employee.statusToday === 'on_leave').length
    const remoteCount = employees.value.filter(employee => employee.statusToday === 'remote').length

    return [
      { title: 'V kanceláři', value: inOfficeCount },
      { title: 'Na dovolené', value: onLeaveCount },
      { title: 'Remote', value: remoteCount },
    ]
  })

  const employeeById = computed(() => {
    return new Map(employees.value.map(employee => [employee.id, employee]))
  })

  const workplaceById = computed(() => {
    return new Map(jobPositions.value.map(position => [position.id, position.name]))
  })

  const statusLabelByValue: Record<LeaveRequestStatus, string> = {
    approved: 'Schváleno',
    pending: 'Čekající',
    rejected: 'Zamítnuto',
  }

  const statusColorByValue: Record<LeaveRequestStatus, 'success' | 'warning' | 'error'> = {
    approved: 'success',
    pending: 'warning',
    rejected: 'error',
  }

  const czechDateFormatter = new Intl.DateTimeFormat('cs-CZ')

  function formatDateToCzech (value: string): string {
    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
      return value
    }

    return czechDateFormatter.format(date)
  }

  function getDateSortValue (value: string): number {
    const parsedDate = new Date(value).getTime()
    return Number.isNaN(parsedDate) ? Number.POSITIVE_INFINITY : parsedDate
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

  async function loadDashboardData (): Promise<void> {
    const [employeesResponse, leaveRequestsResponse, jobPositionsResponse] = await Promise.all([
      fetchApiJson<Employee[]>('/api/employees'),
      fetchApiJson<LeaveRequest[]>('/api/leave-requests'),
      fetchApiJson<JobPosition[]>('/api/job-positions'),
    ])

    employees.value = employeesResponse ?? []
    leaveRequests.value = leaveRequestsResponse ?? []
    jobPositions.value = jobPositionsResponse ?? []
  }

  function getStatusChipColor (status: LeaveRequestStatus): 'success' | 'warning' | 'error' {
    return statusColorByValue[status]
  }

  const pendingRequestRows = computed<PendingRequestRow[]>(() => {
    return leaveRequests.value
      .filter(request => request.status === 'pending')
      .map(request => {
        const employee = employeeById.value.get(request.employeeId)
        const employeeName = employee
          ? `${employee.lastName} ${employee.firstName}`
          : safeUnknownEmployee

        const workplace = employee
          ? (workplaceById.value.get(employee.jobPositionId) ?? safeUnknownWorkplace)
          : safeUnknownWorkplace

        return {
          id: request.id,
          employeeName,
          workplace,
          startDate: formatDateToCzech(request.startDate),
          endDate: formatDateToCzech(request.endDate),
          startDateSort: getDateSortValue(request.startDate),
          endDateSort: getDateSortValue(request.endDate),
          statusLabel: statusLabelByValue[request.status],
          statusRaw: request.status,
          rejectionReason: request.rejectionReason ?? null,
        }
      })
  })

  const filteredPendingRequestRows = computed<PendingRequestRow[]>(() => {
    const query = searchPendingRequests.value.trim().toLocaleLowerCase()

    if (!query) {
      return pendingRequestRows.value
    }

    return pendingRequestRows.value.filter(request => {
      return [request.employeeName, request.workplace, request.startDate, request.endDate, request.statusLabel]
        .join(' ')
        .toLocaleLowerCase()
        .includes(query)
    })
  })

  const pageCount = computed(() => {
    const totalItems = filteredPendingRequestRows.value.length
    return Math.max(1, Math.ceil(totalItems / itemsPerPage.value))
  })

  const paginatedPendingRequestRows = computed<PendingRequestRow[]>(() => {
    const startIndex = (currentPage.value - 1) * itemsPerPage.value
    return filteredPendingRequestRows.value.slice(startIndex, startIndex + itemsPerPage.value)
  })

  const paginationLabel = computed(() => {
    const totalItems = filteredPendingRequestRows.value.length

    if (totalItems === 0) {
      return '0–0 z 0'
    }

    const start = (currentPage.value - 1) * itemsPerPage.value + 1
    const end = Math.min(currentPage.value * itemsPerPage.value, totalItems)

    return `${start}–${end} z ${totalItems}`
  })

  const selectedRequest = computed<PendingRequestRow | null>(() => {
    if (!selectedRequestId.value) {
      return null
    }

    return pendingRequestRows.value.find(request => request.id === selectedRequestId.value) ?? null
  })

  const isRejectAction = computed(() => reviewAction.value === 'rejected')

  const reviewFormValid = computed(() => {
    if (!reviewAction.value) {
      return false
    }

    if (reviewAction.value === 'rejected') {
      return rejectionReason.value.trim().length > 0
    }

    return true
  })

  function openReviewDialog (requestId: string): void {
    selectedRequestId.value = requestId
    reviewAction.value = null
    rejectionReason.value = ''
    reviewDialogVisible.value = true
  }

  function closeReviewDialog (): void {
    reviewDialogVisible.value = false
    selectedRequestId.value = null
    reviewAction.value = null
    rejectionReason.value = ''
  }

  function submitReview (): void {
    const currentRequestId = selectedRequestId.value
    const currentReviewAction = reviewAction.value

    if (!currentRequestId || !currentReviewAction) {
      return
    }

    leaveRequests.value = leaveRequests.value.map(request => {
      if (request.id !== currentRequestId) {
        return request
      }

      return {
        ...request,
        status: currentReviewAction,
        rejectionReason: currentReviewAction === 'rejected' ? rejectionReason.value.trim() : null,
      }
    })

    closeReviewDialog()
  }

  function handleItemsPerPageChange (value: number | string | null): void {
    const nextValue = typeof value === 'number' ? value : Number(value)

    if (!Number.isFinite(nextValue) || nextValue <= 0) {
      return
    }

    itemsPerPage.value = nextValue
    currentPage.value = 1
  }

  watch(filteredPendingRequestRows, rows => {
    if (rows.length === 0) {
      currentPage.value = 1
      return
    }

    if (currentPage.value > pageCount.value) {
      currentPage.value = pageCount.value
    }
  })

  onMounted(() => {
    void loadDashboardData()
  })
</script>

<template>
  <MainRow>
    <PageHeader title="Nástěnka" />
  </MainRow>

  <MainRow>
    <div class="block w-full px-2 sm:px-4">
      <h3 class="px-2 text-2xl uppercase">Dnešní den</h3>

      <div class="mt-4 grid w-full grid-cols-1 gap-6 md:grid-cols-3">
        <v-card
          v-for="card in summaryCards"
          :key="card.title"
          class="h-full border border-white bg-primary py-3 text-center"
        >
          <v-card-title class="px-4">{{ card.title }}</v-card-title>
          <v-card-text class="px-4 text-h3 font-weight-bold">{{ card.value }}</v-card-text>
        </v-card>
      </div>
    </div>
  </MainRow>

  <MainRow>
    <div class="mt-12 block w-full px-2 sm:px-4">
      <v-card flat>
        <v-card-title class="dashboard-card-title flex flex-wrap items-center justify-between gap-4 bg-primary">
          <span class="text-h6 uppercase">Čekající žádosti</span>

          <v-text-field
            v-model="searchPendingRequests"
            class="dashboard-search-field"
            density="compact"
            hide-details
            label="Vyhledat"
            prepend-inner-icon="mdi-magnify"
            single-line
            variant="outlined"
          />
        </v-card-title>

        <v-divider />

        <div class="dashboard-table-scroll overflow-x-auto">
          <v-data-table
            class="dashboard-data-table min-w-[920px]"
            :headers="pendingRequestTableHeaders"
            :hide-default-footer="true"
            item-value="id"
            :items="paginatedPendingRequestRows"
          >
            <template #item.startDateSort="{ item }">
              {{ item.startDate }}
            </template>

            <template #item.endDateSort="{ item }">
              {{ item.endDate }}
            </template>

            <template #item.statusRaw="{ item }">
              <v-chip
                class="px-2"
                :color="getStatusChipColor(item.statusRaw)"
                size="small"
              >
                {{ item.statusLabel }}
              </v-chip>
            </template>

            <template #item.review="{ item }">
              <v-btn
                color="primary"
                size="small"
                variant="outlined"
                @click="openReviewDialog(item.id)"
              >
                Posoudit
              </v-btn>
            </template>

            <template #no-data>
              <div class="px-4 py-6 text-center">
                Nebyly nalezeny žádné čekající žádosti.
              </div>
            </template>
          </v-data-table>
        </div>

        <v-divider />

        <div class="dashboard-table-footer flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-center gap-3">
            <span class="text-body-2 text-medium-emphasis">Položek na stránku</span>
            <v-select
              class="dashboard-items-per-page-select"
              density="compact"
              hide-details
              :items="itemsPerPageOptions"
              :model-value="itemsPerPage"
              variant="outlined"
              @update:model-value="handleItemsPerPageChange"
            />
          </div>

          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <span class="text-body-2 text-medium-emphasis">{{ paginationLabel }}</span>
            <v-pagination
              v-model="currentPage"
              active-color="primary"
              density="compact"
              :length="pageCount"
              rounded="circle"
              total-visible="5"
            />
          </div>
        </div>
      </v-card>
    </div>
  </MainRow>

  <v-dialog
    v-model="reviewDialogVisible"
    max-width="640"
  >
    <v-card>
      <v-card-title class="bg-primary px-6 py-4 text-center text-h6 uppercase">
        Posouzení
      </v-card-title>

      <v-divider />

      <v-card-text class="px-6 py-6">
        <div v-if="selectedRequest" class="mb-6 grid gap-4 sm:grid-cols-2">
          <div>
            <div class="text-caption text-medium-emphasis">Zaměstnanec</div>
            <div class="font-weight-medium">{{ selectedRequest.employeeName }}</div>
          </div>
          <div>
            <div class="text-caption text-medium-emphasis">Pracoviště</div>
            <div class="font-weight-medium">{{ selectedRequest.workplace }}</div>
          </div>
          <div>
            <div class="text-caption text-medium-emphasis">Dovolená od</div>
            <div class="font-weight-medium">{{ selectedRequest.startDate }}</div>
          </div>
          <div>
            <div class="text-caption text-medium-emphasis">Dovolená do</div>
            <div class="font-weight-medium">{{ selectedRequest.endDate }}</div>
          </div>
        </div>

        <div class="grid gap-4">
          <div>
            <div class="mb-2 text-body-2 uppercase">Rozhodnutí</div>
            <div class="mb-4 flex flex-wrap gap-2">
              <v-chip
                class="review-chip review-chip--approve border px-4 uppercase"
                :color="reviewAction === 'approved' ? 'success' : undefined"
                size="small"
                :variant="reviewAction === 'approved' ? 'flat' : 'outlined'"
                @click="reviewAction = 'approved'"
              >
                Schvaluji
              </v-chip>
              <v-chip
                class="review-chip review-chip--reject border px-4 uppercase"
                :color="reviewAction === 'rejected' ? 'error' : undefined"
                size="small"
                :variant="reviewAction === 'rejected' ? 'flat' : 'outlined'"
                @click="reviewAction = 'rejected'"
              >
                Zamítám
              </v-chip>
            </div>
          </div>

          <v-textarea
            v-if="isRejectAction"
            v-model="rejectionReason"
            auto-grow
            label="Důvod zamítnutí"
            placeholder="Doplňte důvod zamítnutí"
            rows="3"
            :rules="[(value: string) => !!value?.trim() || 'Důvod zamítnutí je povinný.']"
            variant="outlined"
          />
        </div>
      </v-card-text>

      <v-divider />

      <v-card-actions class="justify-end px-6 py-4">
        <v-btn
          variant="text"
          @click="closeReviewDialog"
        >
          Zrušit
        </v-btn>
        <v-btn
          color="primary"
          :disabled="!reviewFormValid"
          @click="submitReview"
        >
          Uložit posouzení
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
  .dashboard-table-scroll {
    -webkit-overflow-scrolling: touch;
  }

  .dashboard-card-title {
    padding: 16px;
  }

  .dashboard-search-field {
    width: min(100%, 320px);
  }

  .dashboard-items-per-page-select {
    flex: 0 0 112px;
    width: 112px;
  }

  :deep(.dashboard-items-per-page-select .v-field__input) {
    padding-inline-end: 32px;
  }

  :deep(.dashboard-items-per-page-select .v-select__selection) {
    margin-inline-end: 0;
  }

  :deep(.dashboard-data-table .v-data-table__th),
  :deep(.dashboard-data-table .v-data-table__td) {
    padding-left: 8px;
    padding-right: 8px;
  }

  :deep(.dashboard-data-table .dashboard-col-status),
  :deep(.dashboard-data-table .dashboard-col-review) {
    white-space: nowrap;
    width: 1%;
  }

  .review-chip {
    cursor: pointer;
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.01em;
  }

  :deep(.review-chip.v-chip--variant-flat),
  :deep(.review-chip.v-chip--variant-flat .v-chip__content) {
    color: white;
  }

  .review-chip--approve {
    color: rgb(var(--v-theme-success));
    border-color: rgb(var(--v-theme-success));
  }

  .review-chip--reject {
    color: rgb(var(--v-theme-error));
    border-color: rgb(var(--v-theme-error));
  }
</style>
