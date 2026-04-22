<script setup lang="ts">
  import type {
    Employee,
    JobPosition,
    LeaveRequest,
    LeaveRequestStatus,
    LeaveType,
    UpdateLeaveRequestInput,
  } from '@/types/leave'
  import { useForm } from 'vee-validate'
  import { computed, onMounted, ref, watch } from 'vue'
  import * as yup from 'yup'
  import MainRow from '@/components/MainRow.vue'
  import PageHeader from '@/components/PageHeader.vue'
  import { type StatusFilterValue, type TypeFilterValue, useLeaveRequestsTable } from '@/composables/useLeaveRequestsTable'
  import { getLeaveRequests, updateLeaveRequest } from '@/services/mock/leaveRequestsService'
  import { getEmployees, getJobPositions, getLeaveTypes } from '@/services/mock/referenceDataService'
  import {
    formatDateToCzech,
    getDateSortValue,
    getStatusChipColor,
    leaveRequestStatusLabelsAdjective,
  } from '@/utils/leaveFormat'

  type LeaveRequestRow = {
    id: string
    employeeId: string
    employeeName: string
    workplace: string
    typeLabel: string
    typeRaw: string
    startDate: string
    endDate: string
    createdAt: string
    updatedAt: string
    startDateRaw: string
    endDateRaw: string
    createdAtRaw: string
    updatedAtRaw: string
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

  type LeaveTypeOption = {
    value: string
    title: string
  }

  type EmployeeOption = {
    id: string
    fullName: string
  }

  type RequestEditFormValues = {
    employeeId: string
    startDate: string
    endDate: string
    type: string
    otherTypeDetail: string
    note: string
    status: LeaveRequestStatus
    rejectionReason: string
  }

  const employees = ref<Employee[]>([])
  const jobPositions = ref<JobPosition[]>([])
  const leaveRequests = ref<LeaveRequest[]>([])
  const leaveTypes = ref<LeaveType[]>([])

  const isLoading = ref(false)
  const loadError = ref<string | null>(null)

  const detailDialogVisible = ref(false)
  const selectedRequestId = ref<string | null>(null)
  const detailError = ref<string | null>(null)
  const isSavingDetail = ref(false)

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

  const requestStatusItems: Array<{ title: string, value: LeaveRequestStatus }> = [
    { title: 'Čekající', value: 'pending' },
    { title: 'Schválená', value: 'approved' },
    { title: 'Zamítnutá', value: 'rejected' },
  ]

  const requestEditSchema = yup.object({
    employeeId: yup.string().required('Vyberte zaměstnance.'),
    startDate: yup.string().required('Vyberte datum začátku.'),
    endDate: yup
      .string()
      .required('Vyberte datum konce.')
      .test('end-date-after-start', 'Datum "Do" nesmí být dříve než datum "Od".', (value, context) => {
        const startDate = context.parent.startDate

        if (!value || !startDate) {
          return true
        }

        return new Date(value).getTime() >= new Date(startDate).getTime()
      }),
    type: yup.string().required('Vyberte typ dovolené.'),
    otherTypeDetail: yup
      .string()
      .when('type', ([selectedType], schema) => {
        if (selectedType === 'other') {
          return schema.required('Doplňte jiný typ dovolené.')
        }

        return schema.notRequired()
      }),
    note: yup.string().notRequired(),
    status: yup
      .mixed<LeaveRequestStatus>()
      .oneOf(['pending', 'approved', 'rejected'])
      .required('Vyberte stav žádosti.'),
    rejectionReason: yup
      .string()
      .when('status', ([status], schema) => {
        if (status === 'rejected') {
          return schema.required('Důvod zamítnutí je povinný.')
        }

        return schema.notRequired()
      }),
  })

  const {
    errors: detailFormErrors,
    defineField,
    handleSubmit,
    resetForm,
    setFieldValue,
  } = useForm<RequestEditFormValues>({
    initialValues: {
      employeeId: '',
      startDate: '',
      endDate: '',
      type: '',
      otherTypeDetail: '',
      note: '',
      status: 'pending',
      rejectionReason: '',
    },
    validationSchema: requestEditSchema,
  })

  const [employeeId] = defineField('employeeId')
  const [startDate] = defineField('startDate')
  const [endDate] = defineField('endDate')
  const [type] = defineField('type')
  const [otherTypeDetail] = defineField('otherTypeDetail')
  const [note] = defineField('note')
  const [status] = defineField('status')
  const [rejectionReason] = defineField('rejectionReason')

  const employeeOptions = computed<EmployeeOption[]>(() => {
    return employees.value.map(employee => ({
      id: employee.id,
      fullName: [employee.firstName, employee.lastName].filter(Boolean).join(' ').trim(),
    }))
  })

  const leaveTypeOptions = computed<LeaveTypeOption[]>(() => {
    return leaveTypes.value.map(typeItem => ({
      value: typeItem.id,
      title: typeItem.label,
    }))
  })

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
      ...leaveTypes.value.map(typeItem => ({ title: typeItem.label, value: typeItem.id })),
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
      const createdAtValue = request.requestedAt
      const updatedAtValue = request.updatedAt ?? request.requestedAt

      return {
        id: request.id,
        employeeId: request.employeeId,
        employeeName,
        workplace,
        typeLabel,
        typeRaw: request.type,
        startDate: formatDateToCzech(request.startDate),
        endDate: formatDateToCzech(request.endDate),
        createdAt: formatDateToCzech(createdAtValue),
        updatedAt: formatDateToCzech(updatedAtValue),
        startDateRaw: request.startDate,
        endDateRaw: request.endDate,
        createdAtRaw: createdAtValue,
        updatedAtRaw: updatedAtValue,
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
        request.startDate,
        request.endDate,
        request.createdAt,
        request.note,
        request.rejectionReason ?? '',
        request.otherTypeDetail ?? '',
      ].join(' ')
    },
  })

  const selectedRequestRow = computed<LeaveRequestRow | null>(() => {
    if (!selectedRequestId.value) {
      return null
    }

    return leaveRequestRows.value.find(request => request.id === selectedRequestId.value) ?? null
  })

  const isOtherTypeSelected = computed(() => type.value === 'other')
  const isRejectStatusSelected = computed(() => status.value === 'rejected')

  function openDetailDialog (requestId: string): void {
    const request = leaveRequests.value.find(item => item.id === requestId)

    if (!request) {
      return
    }

    selectedRequestId.value = requestId
    detailError.value = null
    resetForm({
      values: {
        employeeId: request.employeeId,
        startDate: request.startDate,
        endDate: request.endDate,
        type: request.type,
        otherTypeDetail: request.otherTypeDetail ?? '',
        note: request.note ?? '',
        status: request.status,
        rejectionReason: request.rejectionReason ?? '',
      },
    })
    detailDialogVisible.value = true
  }

  function closeDetailDialog (): void {
    detailDialogVisible.value = false
    selectedRequestId.value = null
    detailError.value = null
    resetForm()
  }

  const submitDetailUpdate = handleSubmit(async values => {
    const currentRequestId = selectedRequestId.value

    if (!currentRequestId) {
      return
    }

    detailError.value = null
    isSavingDetail.value = true

    const payload: UpdateLeaveRequestInput = {
      employeeId: values.employeeId,
      startDate: values.startDate,
      endDate: values.endDate,
      type: values.type,
      otherTypeDetail: values.type === 'other' ? values.otherTypeDetail.trim() : null,
      note: values.note.trim() || null,
      status: values.status,
      rejectionReason: values.status === 'rejected' ? values.rejectionReason.trim() : null,
    }

    try {
      const updatedRequest = await updateLeaveRequest(
        currentRequestId,
        payload,
        employees.value,
        leaveTypes.value,
      )

      leaveRequests.value = leaveRequests.value.map(request => {
        return request.id === updatedRequest.id ? updatedRequest : request
      })

      closeDetailDialog()
    } catch (error) {
      detailError.value = error instanceof Error
        ? error.message
        : 'Žádost se nepodařilo uložit.'
    } finally {
      isSavingDetail.value = false
    }
  })

  watch(type, value => {
    if (value !== 'other' && otherTypeDetail.value) {
      setFieldValue('otherTypeDetail', '')
    }
  })

  watch(status, value => {
    if (value !== 'rejected' && rejectionReason.value) {
      setFieldValue('rejectionReason', '')
    }
  })

  const noDataMessage = computed(() => {
    if (isLoading.value) {
      return 'Načítání žádostí...'
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
        <div class="flex flex-col gap-4 bg-primary px-4 py-3">
          <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <h3 class="pr-4 text-2xl uppercase">
              Žádosti
            </h3>

            <div class="flex w-full flex-col gap-3 lg:max-w-5xl lg:flex-row lg:items-center">
              <v-text-field
                v-model="searchRequests"
                density="comfortable"
                hide-details
                placeholder="Hledat v žádostech"
                prepend-inner-icon="mdi-magnify"
                variant="outlined"
              />
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
              <v-btn
                class="shrink-0"
                variant="outlined"
                @click="resetFilters"
              >
                Reset filtrů
              </v-btn>
            </div>
          </div>

          <div
            v-if="activeFilterChips.length > 0"
            class="flex flex-wrap gap-2"
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
        </div>

        <v-divider />

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
            class="min-w-[1180px] px-2"
            :custom-key-sort="{
              startDateSort: (left: number, right: number) => left - right,
              endDateSort: (left: number, right: number) => left - right,
              createdAtSort: (left: number, right: number) => left - right,
            }"
            :headers="requestTableHeaders"
            :hide-default-footer="true"
            item-value="id"
            :items="paginatedRequestRows"
            :loading="isLoading"
            loading-text="Načítání žádostí..."
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
                prepend-icon="mdi-pencil"
                rounded="xl"
                size="small"
                variant="flat"
                @click="openDetailDialog(item.id)"
              >
                Upravit
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
    max-width="760"
  >
    <v-card>
      <v-card-title class="bg-primary px-6 py-4 text-center text-h6 uppercase text-white">
        Úprava žádosti
      </v-card-title>

      <v-divider />

      <v-card-text class="px-6 py-6">
        <div v-if="selectedRequestRow" class="grid gap-6">
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <div class="text-caption text-medium-emphasis">
                Vytvořeno
              </div>
              <div class="font-weight-medium">
                {{ selectedRequestRow.createdAt }}
              </div>
            </div>
            <div>
              <div class="text-caption text-medium-emphasis">
                Naposledy změněno
              </div>
              <div class="font-weight-medium">
                {{ selectedRequestRow.updatedAt }}
              </div>
            </div>
          </div>

          <v-card
            border
            class="rounded-xl"
            variant="tonal"
          >
            <v-card-text class="grid gap-4 sm:grid-cols-2">
              <div>
                <div class="text-caption text-medium-emphasis">
                  Typ dovolené
                </div>
                <div class="font-weight-medium">
                  {{ selectedRequestRow.typeLabel }}
                </div>
              </div>

              <div v-if="selectedRequestRow.typeRaw === 'other'">
                <div class="text-caption text-medium-emphasis">
                  Upřesnění jiného volna
                </div>
                <div class="font-weight-medium">
                  {{ selectedRequestRow.otherTypeDetail || 'Neuvedeno' }}
                </div>
              </div>

              <div class="sm:col-span-2">
                <div class="text-caption text-medium-emphasis">
                  Poznámka zaměstnance
                </div>
                <div class="font-weight-medium whitespace-pre-line">
                  {{ selectedRequestRow.note || 'Bez poznámky' }}
                </div>
              </div>
            </v-card-text>
          </v-card>

          <v-alert
            v-if="detailError"
            type="error"
            variant="tonal"
          >
            {{ detailError }}
          </v-alert>

          <v-form @submit.prevent="submitDetailUpdate">
            <v-row>
              <v-col cols="12" md="6">
                <v-autocomplete
                  v-model="employeeId"
                  :disabled="isSavingDetail"
                  :error-messages="detailFormErrors.employeeId ? [detailFormErrors.employeeId] : []"
                  item-title="fullName"
                  item-value="id"
                  :items="employeeOptions"
                  label="Zaměstnanec"
                  variant="outlined"
                />
              </v-col>

              <v-col cols="12" md="6">
                <v-select
                  v-model="type"
                  :disabled="isSavingDetail"
                  :error-messages="detailFormErrors.type ? [detailFormErrors.type] : []"
                  item-title="title"
                  item-value="value"
                  :items="leaveTypeOptions"
                  label="Typ žádosti"
                  variant="outlined"
                />
              </v-col>

              <v-col v-if="isOtherTypeSelected" cols="12">
                <v-text-field
                  v-model="otherTypeDetail"
                  :disabled="isSavingDetail"
                  :error-messages="detailFormErrors.otherTypeDetail ? [detailFormErrors.otherTypeDetail] : []"
                  label="Upřesnění jiného typu"
                  variant="outlined"
                />
              </v-col>

              <v-col cols="12" md="6">
                <v-text-field
                  v-model="startDate"
                  :disabled="isSavingDetail"
                  :error-messages="detailFormErrors.startDate ? [detailFormErrors.startDate] : []"
                  label="Dovolená od"
                  type="date"
                  variant="outlined"
                />
              </v-col>

              <v-col cols="12" md="6">
                <v-text-field
                  v-model="endDate"
                  :disabled="isSavingDetail"
                  :error-messages="detailFormErrors.endDate ? [detailFormErrors.endDate] : []"
                  label="Dovolená do"
                  :min="startDate || undefined"
                  type="date"
                  variant="outlined"
                />
              </v-col>

              <v-col cols="12" md="6">
                <v-select
                  v-model="status"
                  :disabled="isSavingDetail"
                  :error-messages="detailFormErrors.status ? [detailFormErrors.status] : []"
                  :items="requestStatusItems"
                  label="Stav žádosti"
                  variant="outlined"
                />
              </v-col>

              <v-col v-if="isRejectStatusSelected" cols="12" md="6">
                <v-textarea
                  v-model="rejectionReason"
                  auto-grow
                  :disabled="isSavingDetail"
                  :error-messages="detailFormErrors.rejectionReason ? [detailFormErrors.rejectionReason] : []"
                  label="Důvod zamítnutí"
                  rows="2"
                  variant="outlined"
                />
              </v-col>

              <v-col cols="12">
                <v-textarea
                  v-model="note"
                  auto-grow
                  :disabled="isSavingDetail"
                  label="Poznámka"
                  rows="3"
                  variant="outlined"
                />
              </v-col>
            </v-row>

            <div class="mt-4 flex justify-end gap-3">
              <v-btn
                class="rounded-xl"
                variant="text"
                @click="closeDetailDialog"
              >
                Zrušit
              </v-btn>
              <v-btn
                append-icon="mdi-content-save"
                class="rounded-xl px-2"
                color="success"
                :loading="isSavingDetail"
                type="submit"
                variant="flat"
              >
                Uložit změny
              </v-btn>
            </div>
          </v-form>
        </div>
      </v-card-text>
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

  :deep(.requests-active-filter-chip .v-chip__content) {
    padding-inline: 0.25rem;
  }

  :deep(.requests-active-filter-chip .v-chip__close) {
    margin-inline-start: 0.125rem;
    margin-inline-end: 0;
  }
</style>
