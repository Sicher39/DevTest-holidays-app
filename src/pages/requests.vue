<script setup lang="ts">
  import type { Employee, JobPosition, LeaveRequest, LeaveRequestStatus, LeaveType } from '@/types/leave'
  import { computed, onMounted, ref } from 'vue'
  import MainRow from '@/components/MainRow.vue'
  import PageHeader from '@/components/PageHeader.vue'
  import { useLeaveRequestReview } from '@/composables/useLeaveRequestReview'
  import { type StatusFilterValue, type TypeFilterValue, useLeaveRequestsTable } from '@/composables/useLeaveRequestsTable'
  import { getLeaveRequests } from '@/services/mock/leaveRequestsService'
  import { getEmployees, getJobPositions, getLeaveTypes } from '@/services/mock/referenceDataService'
  import {
    formatDateToCzech,
    getDateSortValue,
    getStatusChipColor,
    leaveRequestStatusLabelsAdjective,
  } from '@/utils/leaveFormat'

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

  const employees = ref<Employee[]>([])
  const jobPositions = ref<JobPosition[]>([])
  const leaveRequests = ref<LeaveRequest[]>([])
  const leaveTypes = ref<LeaveType[]>([])

  const isLoading = ref(false)
  const loadError = ref<string | null>(null)

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

  const statusFilterItems: Array<{ title: string, value: StatusFilterValue }> = [
    { title: 'Všechny stavy', value: 'all' },
    { title: 'Čekající', value: 'pending' },
    { title: 'Schválená', value: 'approved' },
    { title: 'Zamítnutá', value: 'rejected' },
  ]

  async function loadRequestsPageData (): Promise<void> {
    isLoading.value = true
    loadError.value = null

    try {
      const [employeesResponse, leaveRequestsResponse, jobPositionsResponse, leaveTypesResponse] = await Promise.all([
        getEmployees(),
        getLeaveRequests(),
        getJobPositions(),
        getLeaveTypes(),
      ])

      employees.value = employeesResponse
      leaveRequests.value = leaveRequestsResponse
      jobPositions.value = jobPositionsResponse
      leaveTypes.value = leaveTypesResponse
    } catch (error) {
      employees.value = []
      leaveRequests.value = []
      jobPositions.value = []
      leaveTypes.value = []
      loadError.value = error instanceof Error
        ? error.message
        : 'Data žádostí se nepodařilo načíst.'
    } finally {
      isLoading.value = false
    }
  }

  const employeeById = computed(() => new Map(employees.value.map(employee => [employee.id, employee])))
  const workplaceById = computed(() => new Map(jobPositions.value.map(position => [position.id, position.name])))
  const leaveTypeLabelById = computed(() => new Map(leaveTypes.value.map(type => [type.id, type.label])))

  const typeFilterItems = computed<Array<{ title: string, value: TypeFilterValue }>>(() => {
    return [
      { title: 'Všechny typy', value: 'all' },
      ...leaveTypes.value.map(type => ({ title: type.label, value: type.id })),
    ]
  })

  const leaveRequestRows = computed<LeaveRequestRow[]>(() => {
    return leaveRequests.value.map(request => {
      const employee = employeeById.value.get(request.employeeId)
      const employeeName = employee ? `${employee.lastName} ${employee.firstName}` : safeUnknownEmployee
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
        statusLabel: leaveRequestStatusLabelsAdjective[request.status],
        statusRaw: request.status,
        note: request.note ?? '',
        rejectionReason: request.rejectionReason ?? null,
        otherTypeDetail: request.otherTypeDetail ?? null,
      }
    })
  })

  const {
    searchRequests,
    statusFilter,
    typeFilter,
    activeFilterChips,

    itemsPerPageOptions,
    itemsPerPage,
    currentPage,
    pageCount,
    paginatedRows: paginatedRequestRows,
    paginationLabel,
    handleItemsPerPageChange,
    resetFilters,
    removeFilterChip,
  } = useLeaveRequestsTable({
    rows: leaveRequestRows,
    statusLabels: leaveRequestStatusLabelsAdjective,
    getTypeLabel: typeRaw => leaveTypeLabelById.value.get(typeRaw) ?? typeRaw,
    getSearchText: request => {
      return [
        request.employeeName,
        request.workplace,
        request.typeLabel,
        request.statusLabel,
        request.createdAt,
        request.updatedAt,
      ].join(' ')
    },
  })

  const {
    dialogVisible: detailDialogVisible,
    reviewAction,
    rejectionReason,
    selectedRequestId,
    isSavingReview,
    reviewError,
    isRejectAction,
    reviewFormValid,
    openDialog: openDetailDialog,
    closeDialog: closeDetailDialog,
    submitReview,
  } = useLeaveRequestReview({
    leaveRequests,
    submitErrorMessage: 'Rozhodnutí se nepodařilo uložit.',
    getInitialState: request => ({
      action: request?.status && request.status !== 'pending' ? request.status : null,
      rejectionReason: request?.rejectionReason ?? '',
    }),
  })

  const selectedRequest = computed<LeaveRequestRow | null>(() => {
    if (!selectedRequestId.value) {
      return null
    }

    return leaveRequestRows.value.find(request => request.id === selectedRequestId.value) ?? null
  })

  const noDataMessage = computed(() => {
    if (isLoading.value) {
      return 'Načítání žádostí…'
    }

    if (leaveRequestRows.value.length === 0) {
      return 'Zatím nejsou evidovány žádné žádosti.'
    }

    return 'Pro zvolené filtry nebyly nalezeny žádné žádosti.'
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
          <h3 class="text-2xl uppercase pr-4">Žádosti</h3>

          <div class="w-3/12" />

          <div class="flex w-8/12 gap-4 items-center">
            <v-text-field
              v-model="searchRequests"
              density="comfortable"
              hide-details
              prepend-inner-icon="mdi-magnify"
              variant="outlined"
            />
            <v-select
              v-model="statusFilter"
              class="requests-filter-select w-[10px]"
              density="comfortable"
              hide-details
              :items="statusFilterItems"
              variant="outlined"
            />
            <v-select
              v-model="typeFilter"
              class="requests-filter-select w-[10px]"
              density="comfortable"
              hide-details
              :items="typeFilterItems"
              variant="outlined"
            />
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
            class="requests-active-filter-chip"
            closable
            size="small"
            variant="outlined"
            @click:close="removeFilterChip(chip.key)"
          >
            {{ chip.label }}
          </v-chip>
        </div>

        <v-divider v-if="activeFilterChips.length > 0" />

        <v-alert
          v-if="loadError"
          class="mx-4 my-4"
          type="error"
          variant="tonal"
        >
          {{ loadError }}
          <template #append>
            <v-btn
              size="small"
              variant="text"
              @click="loadRequestsPageData"
            >
              Zkusit znovu
            </v-btn>
          </template>
        </v-alert>

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
            item-value="id"
            :items="paginatedRequestRows"
            :loading="isLoading"
            loading-text="Načítání žádostí…"
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
                prepend-icon="mdi-magnify"
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

:deep(.requests-active-filter-chip .v-chip__content) {
  padding-inline: 0.25rem;
}

:deep(.requests-active-filter-chip .v-chip__close) {
  margin-inline-start: 0.125rem;
  margin-inline-end: 0;
}
</style>
