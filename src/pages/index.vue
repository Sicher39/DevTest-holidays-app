<script setup lang="ts">
  import { computed, onMounted, ref, watch } from 'vue'
  import MainRow from '@/components/MainRow.vue'
  import PageHeader from '@/components/PageHeader.vue'
  import { useLeaveRequestReview } from '@/composables/useLeaveRequestReview'
  import { getLeaveRequests } from '@/services/mock/leaveRequestsService'
  import { getEmployees, getJobPositions } from '@/services/mock/referenceDataService'
  import type { Employee, JobPosition, LeaveRequest, LeaveRequestStatus } from '@/types/leave'
  import {
    formatDateToCzech,
    getDateSortValue,
    getStatusChipColor,
    leaveRequestStatusLabelsNoun,
  } from '@/utils/leaveFormat'

  type DashboardCard = {
    title: 'Čekající žádosti' | 'Schválené tento měsíc' | 'Zamítnuté tento měsíc'
    value: number
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

  const isLoading = ref(false)
  const loadError = ref<string | null>(null)

  const searchPendingRequests = ref('')
  const itemsPerPageOptions = [5, 10, 20]
  const itemsPerPage = ref(10)
  const currentPage = ref(1)

  const safeUnknownEmployee = 'Neznámý zaměstnanec'
  const safeUnknownWorkplace = 'Neznámé pracoviště'

  const pendingRequestTableHeaders = [
    { title: 'Příjmení a jméno', key: 'employeeName', sortable: true },
    { title: 'Pracoviště', key: 'workplace', sortable: true },
    { title: 'Dovolená od', key: 'startDateSort', sortable: true },
    { title: 'Dovolená do', key: 'endDateSort', sortable: false },
    {
      title: 'Stav žádosti',
      key: 'statusRaw',
      sortable: true,
      width: '12%',
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

  function isInCurrentMonth (value: string): boolean {
    const parsedDate = new Date(value)

    if (Number.isNaN(parsedDate.getTime())) {
      return false
    }

    const now = new Date()
    return parsedDate.getFullYear() === now.getFullYear() && parsedDate.getMonth() === now.getMonth()
  }

  async function loadDashboardData (): Promise<void> {
    isLoading.value = true
    loadError.value = null

    try {
      const [employeesResponse, leaveRequestsResponse, jobPositionsResponse] = await Promise.all([
        getEmployees(),
        getLeaveRequests(),
        getJobPositions(),
      ])

      employees.value = employeesResponse
      leaveRequests.value = leaveRequestsResponse
      jobPositions.value = jobPositionsResponse
    } catch (error) {
      employees.value = []
      leaveRequests.value = []
      jobPositions.value = []
      loadError.value = error instanceof Error
        ? error.message
        : 'Nástěnku se nepodařilo načíst.'
    } finally {
      isLoading.value = false
    }
  }

  const summaryCards = computed<DashboardCard[]>(() => {
    const pendingCount = leaveRequests.value.filter(request => request.status === 'pending').length
    const approvedThisMonthCount = leaveRequests.value.filter(request => {
      return request.status === 'approved' && isInCurrentMonth(request.requestedAt ?? '')
    }).length
    const rejectedThisMonthCount = leaveRequests.value.filter(request => {
      return request.status === 'rejected' && isInCurrentMonth(request.requestedAt ?? '')
    }).length

    return [
      { title: 'Čekající žádosti', value: pendingCount },
      { title: 'Schválené tento měsíc', value: approvedThisMonthCount },
      { title: 'Zamítnuté tento měsíc', value: rejectedThisMonthCount },
    ]
  })

  const employeeById = computed(() => new Map(employees.value.map(employee => [employee.id, employee])))
  const workplaceById = computed(() => new Map(jobPositions.value.map(position => [position.id, position.name])))

  const pendingRequestRows = computed<PendingRequestRow[]>(() => {
    return leaveRequests.value
      .filter(request => request.status === 'pending')
      .map(request => {
        const employee = employeeById.value.get(request.employeeId)
        const employeeName = employee ? `${employee.lastName} ${employee.firstName}` : safeUnknownEmployee
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
          statusLabel: leaveRequestStatusLabelsNoun[request.status],
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

  const noDataMessage = computed(() => {
    if (isLoading.value) {
      return 'Načítání čekajících žádostí…'
    }

    if (pendingRequestRows.value.length === 0) {
      return 'Aktuálně nejsou žádné čekající žádosti.'
    }

    return 'Pro zadané hledání nebyly nalezeny žádné čekající žádosti.'
  })

  const pageCount = computed(() => {
    return Math.max(1, Math.ceil(filteredPendingRequestRows.value.length / itemsPerPage.value))
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

  const {
    dialogVisible: reviewDialogVisible,
    reviewAction,
    rejectionReason,
    selectedRequestId,
    isSavingReview,
    reviewError,
    isRejectAction,
    reviewFormValid,
    openDialog: openReviewDialog,
    closeDialog: closeReviewDialog,
    submitReview,
  } = useLeaveRequestReview({
    leaveRequests,
  })

  const selectedRequest = computed<PendingRequestRow | null>(() => {
    if (!selectedRequestId.value) {
      return null
    }

    return pendingRequestRows.value.find(request => request.id === selectedRequestId.value) ?? null
  })

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
      <v-card>
        <div class="flex w-full items-center justify-between bg-primary px-4">
          <h3 class="text-2xl uppercase">Čekající žádosti</h3>

          <div class="my-2 flex w-3/12">
            <v-text-field
              v-model="searchPendingRequests"
              hide-details
              prepend-inner-icon="mdi-magnify"
            />
          </div>
        </div>
      </v-card>

      <v-divider />

      <v-alert
        v-if="loadError"
        class="my-4"
        type="error"
        variant="tonal"
      >
        {{ loadError }}
        <template #append>
          <v-btn
            size="small"
            variant="text"
            @click="loadDashboardData"
          >
            Zkusit znovu
          </v-btn>
        </template>
      </v-alert>

      <div class="overflow-x-auto">
        <v-data-table
          class="px-2 min-w-230"
          :custom-key-sort="{
            startDateSort: (left: number, right: number) => left - right,
            endDateSort: (left: number, right: number) => left - right,
          }"
          :headers="pendingRequestTableHeaders"
          :hide-default-footer="true"
          item-value="id"
          :items="paginatedPendingRequestRows"
          :loading="isLoading"
          loading-text="Načítání čekajících žádostí…"
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
              class="px-2"
              prepend-icon="mdi-magnify"
              color="success"
              rounded="xl"
              size="small"
              variant="flat"
              @click="openReviewDialog(item.id)"
            >
              Posoudit
            </v-btn>
          </template>

          <template #no-data>
            <div class="px-4 py-6 text-center">
              {{ noDataMessage }}
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
    </div>
  </MainRow>

  <v-dialog
    v-model="reviewDialogVisible"
    max-width="640"
  >
    <v-card>
      <v-card-title class="bg-primary text-white px-6 py-4 text-center text-h6 uppercase">
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

        <v-alert
          v-if="reviewError"
          class="mb-4"
          type="error"
          variant="tonal"
        >
          {{ reviewError }}
        </v-alert>

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
            class="py-2"
            label="Důvod zamítnutí"
            rows="3"
            :rules="[(value: string) => !!value?.trim() || 'Důvod zamítnutí je povinný.']"
          />
        </div>
      </v-card-text>

      <v-divider />

      <v-card-actions class="justify-end px-2 py-4">
        <v-btn
          class="rounded-xl"
          variant="text"
          @click="closeReviewDialog"
        >
          Zrušit
        </v-btn>
        <v-btn
          class="px-2 rounded-xl"
          color="success"
          append-icon="mdi-check"
          :disabled="!reviewFormValid || isSavingReview"
          :loading="isSavingReview"
          variant="flat"
          @click="submitReview"
        >
          Uložit posouzení
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
