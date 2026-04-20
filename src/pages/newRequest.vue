<script setup lang="ts">
  import { useForm } from 'vee-validate'
  import { computed, onMounted, ref, watch } from 'vue'
  import * as yup from 'yup'
  import MainRow from '@/components/MainRow.vue'
  import PageHeader from '@/components/PageHeader.vue'
  import { getEmployees, getLeaveTypes } from '@/services/mock/referenceDataService'
  import { createLeaveRequest } from '@/services/mock/leaveRequestsService'
  import type { CreateLeaveRequestInput, Employee, LeaveType } from '@/types/leave'

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

  const employees = ref<Employee[]>([])
  const leaveTypes = ref<LeaveType[]>([])
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

  function mapEmployeeOptions (items: Employee[]): EmployeeOption[] {
    return items.map(employee => ({
      id: employee.id,
      fullName: [employee.firstName, employee.lastName].filter(Boolean).join(' ').trim(),
    }))
  }

  function mapLeaveTypeOptions (items: LeaveType[]): LeaveTypeOption[] {
    return items.map(typeItem => ({
      value: typeItem.id,
      title: typeItem.label,
    }))
  }

  async function loadFormOptions () {
    isOptionsLoading.value = true
    loadError.value = null

    try {
      const [employeesResponse, leaveTypesResponse] = await Promise.all([
        getEmployees(),
        getLeaveTypes(),
      ])

      employees.value = employeesResponse
      leaveTypes.value = leaveTypesResponse
      employeeOptions.value = mapEmployeeOptions(employeesResponse)
      leaveTypeOptions.value = mapLeaveTypeOptions(leaveTypesResponse)

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

    const payload: CreateLeaveRequestInput = {
      employeeId: values.employeeId,
      startDate: values.startDate,
      endDate: values.endDate,
      type: values.type,
      otherTypeDetail: values.type === 'other' ? values.otherTypeDetail.trim() : null,
      note: values.note.trim() || null,
    }

    try {
      await createLeaveRequest(payload, employees.value, leaveTypes.value)
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
    <div class="flex w-full px-2 justify-center ">
      <v-card class="mt-6 w-full md:w-8/12">
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
                append-icon="mdi-send-outline"
                rounded="lg "
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
