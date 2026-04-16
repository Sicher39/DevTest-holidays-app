<script setup lang="ts">
  import { computed, onMounted, ref, watch } from 'vue'
  import MainRow from '@/components/MainRow.vue'
  import PageHeader from '@/components/PageHeader.vue'

  type LeaveRequestStatus = 'approved' | 'pending' | 'rejected'
  type ReviewAction = 'approved' | 'rejected'
  type StatusFilterValue = 'all' | LeaveRequestStatus
  type TypeFilterValue = 'all' | string

  type LeaveRequest = {
    id: string
    employeeId: string
    type: string
    startDate: string
    endDate: string
    status: LeaveRequestStatus
    requestedAt?: string
    updatedAt?: string
    rejectionReason?: string | null
    note?: string
    otherTypeDetail?: string | null
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

  type LeaveType = {
    id: string
    label: string
  }

  type LeaveRequestRow = {
    id: string
    employeeName: string
    workplace: string
    typeLabel: string
    typeRaw: string
    startDate: string
    endDate: string
    createdAt: string
    updatedAt: string
    startDateSort: number
    endDateSort: number
    createdAtSort: number
    updatedAtSort: number
    statusLabel: string
    statusRaw: LeaveRequestStatus
    note: string
    rejectionReason?: string | null
    otherTypeDetail?: string | null
  }

  type ApiErrorResponse = {
    message?: string
  }

  type ActiveFilterChip = {
    key: 'search' | 'status' | 'type'
    label: string
  }

  const employees = ref<Employee[]>([])
  const jobPositions = ref<JobPosition[]>([])
  const leaveRequests = ref<LeaveRequest[]>([])
  const leaveTypes = ref<LeaveType[]>([])

  const searchRequests = ref('')
  const statusFilter = ref<StatusFilterValue>('all')
  const typeFilter = ref<TypeFilterValue>('all')
  const itemsPerPageOptions = [5, 10, 20]
  const itemsPerPage = ref(10)
  const currentPage = ref(1)

  const detailDialogVisible = ref(false)
  const reviewAction = ref<ReviewAction | null>(null)
  const rejectionReason = ref('')
  const selectedRequestId = ref<string | null>(null)
  const isSavingReview = ref(false)
  const reviewError = ref<string | null>(null)

  const safeUnknownEmployee = 'Neznámý zaměstnanec'
  const safeUnknownWorkplace = 'Neznámé pracoviště'
  const safeUnknownType = 'Neznámý typ'

  const requestTableHeaders = [
    { title: 'Příjmení a jméno', key: 'employeeName', sortable: true },
    { title: 'Pracoviště', key: 'workplace', sortable: true },
    { title: 'Typ žádosti', key: 'typeLabel', sortable: true },
    { title: 'Dovolená od', key: 'startDateSort', sortable: true },
    { title: 'Dovolená do', key: 'endDateSort', sortable: true },
    { title: 'Vytvořeno', key: 'createdAtSort', sortable: true },
    { title: 'Změněno', key: 'updatedAtSort', sortable: true },
    {
      title: 'Stav žádosti',
      key: 'statusRaw',
      sortable: true,
      width: '12%',
      cellProps: { class: 'requests-col-status' },
      headerProps: { class: 'requests-col-status' },
    },
    {
      title: 'Detail',
      key: 'detail',
      sortable: false,
      align: 'start' as const,
      width: '1%',
      cellProps: { class: 'requests-col-detail' },
      headerProps: { class: 'requests-col-detail' },
    },
  ]

  const statusLabelByValue: Record<LeaveRequestStatus, string> = {
    approved: 'Schválená',
    pending: 'Čekající',
    rejected: 'Zamítnutá',
  }

  const statusColorByValue: Record<LeaveRequestStatus, 'success' | 'warning' | 'error'> = {
    approved: 'success',
    pending: 'warning',
    rejected: 'error',
  }

  const statusFilterItems: Array<{ title: string, value: StatusFilterValue }> = [
    { title: 'Všechny stavy', value: 'all' },
    { title: 'Čekající', value: 'pending' },
    { title: 'Schválená', value: 'approved' },
    { title: 'Zamítnutá', value: 'rejected' },
  ]

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

  function getStatusChipColor (status: LeaveRequestStatus): 'success' | 'warning' | 'error' {
    return statusColorByValue[status]
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

  async function loadRequestsPageData (): Promise<void> {
    const [employeesResponse, leaveRequestsResponse, jobPositionsResponse, leaveTypesResponse] = await Promise.all([
      fetchApiJson<Employee[]>('/api/employees'),
      fetchApiJson<LeaveRequest[]>('/api/leave-requests'),
      fetchApiJson<JobPosition[]>('/api/job-positions'),
      fetchApiJson<LeaveType[]>('/api/leave-types'),
    ])

    employees.value = employeesResponse ?? []
    leaveRequests.value = leaveRequestsResponse ?? []
    jobPositions.value = jobPositionsResponse ?? []
    leaveTypes.value = leaveTypesResponse ?? []
  }

  const employeeById = computed(() => {
    return new Map(employees.value.map(employee => [employee.id, employee]))
  })

  const workplaceById = computed(() => {
    return new Map(jobPositions.value.map(position => [position.id, position.name]))
  })

  const leaveTypeLabelById = computed(() => {
    return new Map(leaveTypes.value.map(type => [type.id, type.label]))
  })

  const typeFilterItems = computed<Array<{ title: string, value: TypeFilterValue }>>(() => {
    return [
      { title: 'Všechny typy', value: 'all' },
      ...leaveTypes.value.map(type => ({
        title: type.label,
        value: type.id,
      })),
    ]
  })

  const leaveRequestRows = computed<LeaveRequestRow[]>(() => {
    return leaveRequests.value.map(request => {
      const employee = employeeById.value.get(request.employeeId)
      const employeeName = employee
        ? `${employee.lastName} ${employee.firstName}`
        : safeUnknownEmployee

      const workplace = employee
        ? (workplaceById.value.get(employee.jobPositionId) ?? safeUnknownWorkplace)
        : safeUnknownWorkplace

      const typeLabel = leaveTypeLabelById.value.get(request.type) ?? safeUnknownType
      const createdAtValue = request.requestedAt ?? ''
      const updatedAtValue = request.updatedAt ?? request.requestedAt ?? ''

      return {
        id: request.id,
        employeeName,
        workplace,
        typeLabel,
        typeRaw: request.type,
        startDate: formatDateToCzech(request.startDate),
        endDate: formatDateToCzech(request.endDate),
        createdAt: formatDateToCzech(createdAtValue),
        updatedAt: formatDateToCzech(updatedAtValue),
        startDateSort: getDateSortValue(request.startDate),
        endDateSort: getDateSortValue(request.endDate),
        createdAtSort: getDateSortValue(createdAtValue),
        updatedAtSort: getDateSortValue(updatedAtValue),
        statusLabel: statusLabelByValue[request.status],
        statusRaw: request.status,
        note: request.note ?? '',
        rejectionReason: request.rejectionReason ?? null,
        otherTypeDetail: request.otherTypeDetail ?? null,
      }
    })
  })

  const filteredRequestRows = computed<LeaveRequestRow[]>(() => {
    const query = searchRequests.value.trim().toLocaleLowerCase()

    return leaveRequestRows.value.filter(request => {
      const matchesStatus = statusFilter.value === 'all' || request.statusRaw === statusFilter.value
      const matchesType = typeFilter.value === 'all' || request.typeRaw === typeFilter.value

      if (!matchesStatus || !matchesType) {
        return false
      }

      if (!query) {
        return true
      }

      return [
        request.employeeName,
        request.workplace,
        request.typeLabel,
        request.statusLabel,
        request.createdAt,
        request.updatedAt,
      ]
        .join(' ')
        .toLocaleLowerCase()
        .includes(query)
    })
  })

  const activeFilterChips = computed<ActiveFilterChip[]>(() => {
    const chips: ActiveFilterChip[] = []

    if (statusFilter.value !== 'all') {
      chips.push({
        key: 'status',
        label: `Stav: ${statusLabelByValue[statusFilter.value]}`,
      })
    }

    if (typeFilter.value !== 'all') {
      const typeLabel = leaveTypeLabelById.value.get(typeFilter.value) ?? typeFilter.value
      chips.push({
        key: 'type',
        label: `Typ: ${typeLabel}`,
      })
    }

    if (searchRequests.value.trim()) {
      chips.push({
        key: 'search',
        label: `Hledání: ${searchRequests.value.trim()}`,
      })
    }

    return chips
  })

  const pageCount = computed(() => {
    const totalItems = filteredRequestRows.value.length
    return Math.max(1, Math.ceil(totalItems / itemsPerPage.value))
  })

  const paginatedRequestRows = computed<LeaveRequestRow[]>(() => {
    const startIndex = (currentPage.value - 1) * itemsPerPage.value
    return filteredRequestRows.value.slice(startIndex, startIndex + itemsPerPage.value)
  })

  const paginationLabel = computed(() => {
    const totalItems = filteredRequestRows.value.length

    if (totalItems === 0) {
      return '0–0 z 0'
    }

    const start = (currentPage.value - 1) * itemsPerPage.value + 1
    const end = Math.min(currentPage.value * itemsPerPage.value, totalItems)

    return `${start}–${end} z ${totalItems}`
  })

  const selectedRequest = computed<LeaveRequestRow | null>(() => {
    if (!selectedRequestId.value) {
      return null
    }

    return leaveRequestRows.value.find(request => request.id === selectedRequestId.value) ?? null
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

  function openDetailDialog (requestId: string): void {
    const request = leaveRequests.value.find(item => item.id === requestId)

    selectedRequestId.value = requestId
    reviewAction.value = request?.status === 'pending' ? null : request?.status ?? null
    rejectionReason.value = request?.rejectionReason ?? ''
    reviewError.value = null
    detailDialogVisible.value = true
  }

  function closeDetailDialog (): void {
    detailDialogVisible.value = false
    selectedRequestId.value = null
    reviewAction.value = null
    rejectionReason.value = ''
    reviewError.value = null
  }

  async function submitReview (): Promise<void> {
    if (!selectedRequestId.value || !reviewAction.value) {
      return
    }

    isSavingReview.value = true
    reviewError.value = null

    try {
      const response = await fetch(`/api/leave-requests/${selectedRequestId.value}/review`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: reviewAction.value,
          rejectionReason: reviewAction.value === 'rejected' ? rejectionReason.value.trim() : null,
        }),
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null) as ApiErrorResponse | null
        throw new Error(errorBody?.message ?? 'Uložení rozhodnutí selhalo.')
      }

      const updatedRequest = await response.json() as LeaveRequest
      leaveRequests.value = leaveRequests.value.map(request => {
        return request.id === updatedRequest.id ? updatedRequest : request
      })

      closeDetailDialog()
    } catch (error) {
      reviewError.value = error instanceof Error
        ? error.message
        : 'Rozhodnutí se nepodařilo uložit.'
    } finally {
      isSavingReview.value = false
    }
  }

  function handleItemsPerPageChange (value: number | string | null): void {
    const nextValue = typeof value === 'number' ? value : Number(value)

    if (!Number.isFinite(nextValue) || nextValue <= 0) {
      return
    }

    itemsPerPage.value = nextValue
    currentPage.value = 1
  }

  function resetFilters (): void {
    searchRequests.value = ''
    statusFilter.value = 'all'
    typeFilter.value = 'all'
    currentPage.value = 1
  }

  function removeFilterChip (key: ActiveFilterChip['key']): void {
    if (key === 'search') {
      searchRequests.value = ''
    }

    if (key === 'status') {
      statusFilter.value = 'all'
    }

    if (key === 'type') {
      typeFilter.value = 'all'
    }

    currentPage.value = 1
  }

  watch(filteredRequestRows, rows => {
    if (rows.length === 0) {
      currentPage.value = 1
      return
    }

    if (currentPage.value > pageCount.value) {
      currentPage.value = pageCount.value
    }
  })

  onMounted(() => {
    void loadRequestsPageData()
  })
</script>

<template>
  <PageHeader title="Žádosti" />

  <MainRow>
    <div class="mt-12 block w-full px-2 sm:px-4">
      <v-card>
        <div class="flex w-full items-center justify-between bg-primary px-4 py-2">
          <h3 class="text-2xl uppercase">Žádosti o dovolenou</h3>

          <div class="my-2 flex w-full flex-wrap items-center justify-end gap-2">
            <v-select
              v-model="statusFilter"
              class="requests-filter-select"
              density="comfortable"
              hide-details
              :items="statusFilterItems"
              variant="outlined"
            />
            <v-select
              v-model="typeFilter"
              class="requests-filter-select"
              density="comfortable"
              hide-details
              :items="typeFilterItems"
              variant="outlined"
            />
            <div class="w-full max-w-[360px]">
              <v-text-field
                v-model="searchRequests"
                hide-details
                prepend-inner-icon="mdi-magnify"
                variant="outlined"
              />
            </div>
            <v-btn
              class="shrink-0"
              variant="outlined"
              @click="resetFilters"
            >
              Reset filtrů
            </v-btn>
          </div>
        </div>

        <v-divider />

        <div
          v-if="activeFilterChips.length > 0"
          class="flex flex-wrap gap-2 px-4 py-3"
        >
          <v-chip
            v-for="chip in activeFilterChips"
            :key="chip.key"
            closable
            size="small"
            variant="outlined"
            @click:close="removeFilterChip(chip.key)"
          >
            {{ chip.label }}
          </v-chip>
        </div>

        <v-divider v-if="activeFilterChips.length > 0" />

        <div class="overflow-x-auto">
          <v-data-table
            class="px-2 min-w-[1280px]"
            :custom-key-sort="{
              startDateSort: (left: number, right: number) => left - right,
              endDateSort: (left: number, right: number) => left - right,
              createdAtSort: (left: number, right: number) => left - right,
              updatedAtSort: (left: number, right: number) => left - right,
            }"
            :headers="requestTableHeaders"
            :hide-default-footer="true"
            :items="paginatedRequestRows"
            item-value="id"
          >
            <template #item.startDateSort="{ item }">
              {{ item.startDate }}
            </template>

            <template #item.endDateSort="{ item }">
              {{ item.endDate }}
            </template>

            <template #item.createdAtSort="{ item }">
              {{ item.createdAt }}
            </template>

            <template #item.updatedAtSort="{ item }">
              {{ item.updatedAt }}
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

            <template #item.detail="{ item }">
              <v-btn
                class="px-2"
                color="success"
                rounded="xl"
                size="small"
                variant="flat"
                @click="openDetailDialog(item.id)"
              >
                Detail
              </v-btn>
            </template>

            <template #no-data>
              <div class="px-4 py-6 text-center">
                Nebyly nalezeny žádné žádosti.
              </div>
            </template>
          </v-data-table>
        </div>

        <v-divider />

        <div class="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-center gap-3">
            <span class="px-4 text-medium-emphasis">Položek na stránku</span>
            <v-select
              density="comfortable"
              hide-details
              :items="itemsPerPageOptions"
              :model-value="itemsPerPage"
              @update:model-value="handleItemsPerPageChange"
            />
          </div>

          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <span class="text-body-2 text-medium-emphasis">{{ paginationLabel }}</span>
            <v-pagination
              v-model="currentPage"
              density="comfortable"
              :length="pageCount"
              rounded="xl"
              total-visible="5"
            />
          </div>
        </div>
      </v-card>
    </div>
  </MainRow>

  <v-dialog
    v-model="detailDialogVisible"
    max-width="720"
  >
    <v-card>
      <v-card-title class="bg-primary px-6 py-4 text-center text-h6 uppercase text-white">
        Detail žádosti
      </v-card-title>

      <v-divider />

      <v-card-text class="px-6 py-6">
        <div v-if="selectedRequest" class="grid gap-6">
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <div class="text-caption text-medium-emphasis">Zaměstnanec</div>
              <div class="font-weight-medium">{{ selectedRequest.employeeName }}</div>
            </div>
            <div>
              <div class="text-caption text-medium-emphasis">Pracoviště</div>
              <div class="font-weight-medium">{{ selectedRequest.workplace }}</div>
            </div>
            <div>
              <div class="text-caption text-medium-emphasis">Typ žádosti</div>
              <div class="font-weight-medium">{{ selectedRequest.typeLabel }}</div>
            </div>
            <div v-if="selectedRequest.otherTypeDetail">
              <div class="text-caption text-medium-emphasis">Upřesnění typu</div>
              <div class="font-weight-medium">{{ selectedRequest.otherTypeDetail }}</div>
            </div>
            <div>
              <div class="text-caption text-medium-emphasis">Dovolená od</div>
              <div class="font-weight-medium">{{ selectedRequest.startDate }}</div>
            </div>
            <div>
              <div class="text-caption text-medium-emphasis">Dovolená do</div>
              <div class="font-weight-medium">{{ selectedRequest.endDate }}</div>
            </div>
            <div>
              <div class="text-caption text-medium-emphasis">Vytvořeno</div>
              <div class="font-weight-medium">{{ selectedRequest.createdAt }}</div>
            </div>
            <div>
              <div class="text-caption text-medium-emphasis">Změněno</div>
              <div class="font-weight-medium">{{ selectedRequest.updatedAt }}</div>
            </div>
          </div>

          <div>
            <div class="text-caption text-medium-emphasis">Poznámka</div>
            <div class="font-weight-medium">{{ selectedRequest.note || 'Bez poznámky' }}</div>
          </div>

          <div v-if="selectedRequest.rejectionReason">
            <div class="text-caption text-medium-emphasis">Důvod zamítnutí</div>
            <div class="font-weight-medium">{{ selectedRequest.rejectionReason }}</div>
          </div>

          <v-alert
            v-if="reviewError"
            type="error"
            variant="tonal"
          >
            {{ reviewError }}
          </v-alert>

          <div class="grid gap-4">
            <div>
              <div class="mb-2 text-body-2 uppercase">Změna rozhodnutí</div>
              <div class="mb-4 flex flex-wrap gap-2">
                <v-chip
                  class="review-chip review-chip--approve border px-4 uppercase"
                  :color="reviewAction === 'approved' ? 'success' : undefined"
                  size="small"
                  :variant="reviewAction === 'approved' ? 'flat' : 'outlined'"
                  @click="reviewAction = 'approved'"
                >
                  Schválit
                </v-chip>
                <v-chip
                  class="review-chip review-chip--reject border px-4 uppercase"
                  :color="reviewAction === 'rejected' ? 'error' : undefined"
                  size="small"
                  :variant="reviewAction === 'rejected' ? 'flat' : 'outlined'"
                  @click="reviewAction = 'rejected'"
                >
                  Zamítnout
                </v-chip>
              </div>
            </div>

            <v-textarea
              v-if="isRejectAction"
              v-model="rejectionReason"
              auto-grow
              class="py-2"
              label="Důvod zamítnutí"
              placeholder="Doplňte důvod zamítnutí"
              rows="3"
              :rules="[(value: string) => !!value?.trim() || 'Důvod zamítnutí je povinný.']"
            />
          </div>
        </div>
      </v-card-text>

      <v-divider />

      <v-card-actions class="justify-end px-2 py-4">
        <v-btn
          class="rounded-xl"
          variant="text"
          @click="closeDetailDialog"
        >
          Zavřít
        </v-btn>
        <v-btn
          class="rounded-xl px-2"
          color="success"
          :disabled="!reviewFormValid || isSavingReview"
          :loading="isSavingReview"
          variant="flat"
          @click="submitReview"
        >
          Uložit rozhodnutí
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
  .requests-filter-select {
    min-width: 180px;
  }

  :deep(.requests-col-status),
  :deep(.requests-col-detail) {
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
