<script setup lang="ts">
  import { useForm } from 'vee-validate'
  import { computed, onMounted, ref, watch } from 'vue'
  import * as yup from 'yup'
  import MainRow from '@/components/MainRow.vue'
  import PageHeader from '@/components/PageHeader.vue'

  type EmployeeApiItem = {
    id: string
    firstName?: string
    lastName?: string
    name?: string
  }

  type LeaveTypeApiItem = {
    id: string
    name?: string
    label?: string
    value?: string
  }

  type ApiErrorResponse = {
    message?: string
  }

  type EmployeeOption = {
    id: string
    fullName: string
  }

  type LeaveTypeOption = {
    value: string
    title: string
  }

  type LeaveRequestFormValues = {
    employeeId: string
    startDate: string
    endDate: string
    type: string
    otherTypeDetail: string
    note: string
  }

  const defaultFormValues: LeaveRequestFormValues = {
    employeeId: '',
    startDate: '',
    endDate: '',
    type: '',
    otherTypeDetail: '',
    note: '',
  }

  const employeeOptions = ref<EmployeeOption[]>([])
  const leaveTypeOptions = ref<LeaveTypeOption[]>([])

  const isOptionsLoading = ref(false)
  const loadError = ref<string | null>(null)

  const submitError = ref<string | null>(null)
  const successSnackbarVisible = ref(false)

  const leaveRequestSchema = yup.object({
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
  })

  const {
    errors,
    defineField,
    handleSubmit,
    isSubmitting,
    resetForm,
    setFieldValue,
  } = useForm<LeaveRequestFormValues>({
    initialValues: defaultFormValues,
    validationSchema: leaveRequestSchema,
  })

  const [employeeId] = defineField('employeeId')
  const [startDate] = defineField('startDate')
  const [endDate] = defineField('endDate')
  const [type] = defineField('type')
  const [otherTypeDetail] = defineField('otherTypeDetail')
  const [note] = defineField('note')

  const isOtherTypeSelected = computed(() => type.value === 'other')

  function normalizeEmployeeOptions (items: unknown[]): EmployeeOption[] {
    return items
      .map(item => {
        const employee = item as Partial<EmployeeApiItem>

        if (!employee?.id) {
          return null
        }

        const fullName = employee.name
          ? employee.name.trim()
          : [employee.firstName, employee.lastName].filter(Boolean).join(' ').trim()

        if (!fullName) {
          return null
        }

        return {
          id: employee.id,
          fullName,
        }
      })
      .filter((item): item is EmployeeOption => item !== null)
  }

  function normalizeLeaveTypeOptions (items: unknown[]): LeaveTypeOption[] {
    return items
      .map(item => {
        const leaveType = item as Partial<LeaveTypeApiItem>
        const value = leaveType.value ?? leaveType.id
        const title = leaveType.label ?? leaveType.name

        if (!value || !title) {
          return null
        }

        return {
          value,
          title,
        }
      })
      .filter((item): item is LeaveTypeOption => item !== null)
  }

  async function fetchJson<T> (url: string): Promise<T> {
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Načtení ${url} selhalo se stavem ${response.status}.`)
    }

    return await response.json() as T
  }

  async function loadFormOptions () {
    isOptionsLoading.value = true
    loadError.value = null

    try {
      const [employeesResponse, leaveTypesResponse] = await Promise.all([
        fetchJson<unknown[]>('/api/employees'),
        fetchJson<unknown[]>('/api/leave-types'),
      ])

      employeeOptions.value = normalizeEmployeeOptions(employeesResponse)
      leaveTypeOptions.value = normalizeLeaveTypeOptions(leaveTypesResponse)

      if (employeeOptions.value.length === 0 || leaveTypeOptions.value.length === 0) {
        loadError.value = 'Nepodařilo se načíst všechny podklady pro formulář. Zkuste to prosím znovu.'
      }
    } catch {
      loadError.value = 'Načtení dat formuláře selhalo. Zkuste to prosím znovu.'
    } finally {
      isOptionsLoading.value = false
    }
  }

  const onSubmit = handleSubmit(async values => {
    submitError.value = null

    const payload = {
      employeeId: values.employeeId,
      startDate: values.startDate,
      endDate: values.endDate,
      type: values.type,
      otherTypeDetail: values.type === 'other' ? values.otherTypeDetail.trim() : null,
      note: values.note.trim() || null,
    }

    try {
      const response = await fetch('/api/leave-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null) as ApiErrorResponse | null
        throw new Error(errorBody?.message ?? 'Odeslání žádosti selhalo.')
      }

      successSnackbarVisible.value = true
      resetForm({ values: defaultFormValues })
    } catch (error) {
      submitError.value = error instanceof Error
        ? error.message
        : 'Žádost se nepodařilo odeslat. Zkuste to prosím znovu.'
    }
  })

  watch(type, value => {
    if (value !== 'other' && otherTypeDetail.value) {
      setFieldValue('otherTypeDetail', '')
    }
  })

  onMounted(() => {
    void loadFormOptions()
  })
</script>

<template>
  <PageHeader title="Nová žádost o dovolenou" />
  <MainRow>
    <div class="w-full px-2 sm:px-4">
      <v-card class="mt-6 w-full">
        <v-card-title class="bg-primary px-6 py-4 text-h6 uppercase">
          Formulář žádosti
        </v-card-title>

        <v-divider />

        <v-card-text class="px-6 py-6">
          <v-alert
            v-if="loadError"
            class="mb-6"
            type="error"
            variant="tonal"
          >
            {{ loadError }}
            <template #append>
              <v-btn
                class="px-2"
                color="error"
                :loading="isOptionsLoading"
                variant="text"
                @click="loadFormOptions"
              >
                Zkusit znovu
              </v-btn>
            </template>
          </v-alert>

          <v-form @submit.prevent="onSubmit">
            <v-row>
              <v-col cols="12" md="6">
                <v-autocomplete
                  v-model="employeeId"
                  clearable
                  :disabled="isOptionsLoading || isSubmitting"
                  :error-messages="errors.employeeId ? [errors.employeeId] : []"
                  item-title="fullName"
                  item-value="id"
                  :items="employeeOptions"
                  label="Zaměstnanec"
                  :loading="isOptionsLoading"
                  no-data-text="Žádní zaměstnanci"
                  placeholder="Vyberte zaměstnance"
                  required
                  variant="outlined"
                />
              </v-col>

              <v-col cols="12" md="3">
                <v-text-field
                  v-model="startDate"
                  :disabled="isSubmitting"
                  :error-messages="errors.startDate ? [errors.startDate] : []"
                  label="Od"
                  required
                  type="date"
                  variant="outlined"
                />
              </v-col>

              <v-col cols="12" md="3">
                <v-text-field
                  v-model="endDate"
                  :disabled="isSubmitting"
                  :error-messages="errors.endDate ? [errors.endDate] : []"
                  label="Do"
                  required
                  type="date"
                  variant="outlined"
                />
              </v-col>

              <v-col cols="12" md="6">
                <v-select
                  v-model="type"
                  :disabled="isOptionsLoading || isSubmitting"
                  :error-messages="errors.type ? [errors.type] : []"
                  item-title="title"
                  item-value="value"
                  :items="leaveTypeOptions"
                  label="Typ dovolené"
                  :loading="isOptionsLoading"
                  no-data-text="Žádné typy dovolené"
                  placeholder="Vyberte typ dovolené"
                  required
                  variant="outlined"
                />
              </v-col>

              <v-col v-if="isOtherTypeSelected" cols="12" md="6">
                <v-text-field
                  v-model="otherTypeDetail"
                  :disabled="isSubmitting"
                  :error-messages="errors.otherTypeDetail ? [errors.otherTypeDetail] : []"
                  label="Jiný typ dovolené"
                  placeholder="Doplňte jiný typ"

                  variant="outlined"
                />
              </v-col>

              <v-col cols="12">
                <v-textarea
                  v-model="note"
                  :disabled="isSubmitting"
                  label="Poznámka (volitelně)"
                  variant="outlined"
                />
              </v-col>
            </v-row>

            <v-alert
              v-if="submitError"
              class="mb-4"
              type="error"
              variant="tonal"
            >
              {{ submitError }}
            </v-alert>

            <div class="flex justify-end">
              <v-btn
                class="px-2"
                color="primary"
                :disabled="isOptionsLoading"
                :loading="isSubmitting"
                type="submit"
              >
                Odeslat žádost
              </v-btn>
            </div>
          </v-form>
        </v-card-text>
      </v-card>

      <v-snackbar
        v-model="successSnackbarVisible"
        color="success"
        timeout="3000"
      >
        Žádost byla úspěšně odeslána.
      </v-snackbar>
    </div>
  </MainRow>
</template>
