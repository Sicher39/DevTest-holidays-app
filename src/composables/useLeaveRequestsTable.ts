import type { LeaveRequestStatus } from '@/types/leave'
import { computed, type ComputedRef, ref, type Ref, watch } from 'vue'
import { formatPaginationLabel } from '@/utils/pagination'

export type StatusFilterValue = 'all' | LeaveRequestStatus
export type TypeFilterValue = 'all' | string

export type ActiveFilterChip = {
  key: 'search' | 'status' | 'type'
  label: string
}

type LeaveRequestsTableRowBase = {
  statusRaw: LeaveRequestStatus
  typeRaw: string
}

type UseLeaveRequestsTableOptions<Row extends LeaveRequestsTableRowBase> = {
  rows: Ref<Row[]> | ComputedRef<Row[]>
  getSearchText: (row: Row) => string
  statusLabels: Record<LeaveRequestStatus, string>
  getTypeLabel: (type: string) => string
  itemsPerPageOptions?: number[]
}

export function useLeaveRequestsTable<Row extends LeaveRequestsTableRowBase> (options: UseLeaveRequestsTableOptions<Row>) {
  const {
    rows,
    getSearchText,
    statusLabels,
    getTypeLabel,
    itemsPerPageOptions = [5, 10, 20],
  } = options

  const searchRequests = ref('')
  const statusFilter = ref<StatusFilterValue>('all')
  const typeFilter = ref<TypeFilterValue>('all')

  const itemsPerPage = ref(itemsPerPageOptions[1] ?? itemsPerPageOptions[0] ?? 10)
  const currentPage = ref(1)

  const filteredRows = computed<Row[]>(() => {
    const query = searchRequests.value.trim().toLocaleLowerCase()

    return rows.value.filter(row => {
      const matchesStatus = statusFilter.value === 'all' || row.statusRaw === statusFilter.value
      const matchesType = typeFilter.value === 'all' || row.typeRaw === typeFilter.value

      if (!matchesStatus || !matchesType) {
        return false
      }

      if (!query) {
        return true
      }

      return getSearchText(row).toLocaleLowerCase().includes(query)
    })
  })

  const activeFilterChips = computed<ActiveFilterChip[]>(() => {
    const chips: ActiveFilterChip[] = []

    if (statusFilter.value !== 'all') {
      chips.push({
        key: 'status',
        label: `Stav: ${statusLabels[statusFilter.value]}`,
      })
    }

    if (typeFilter.value !== 'all') {
      chips.push({
        key: 'type',
        label: `Typ: ${getTypeLabel(typeFilter.value)}`,
      })
    }

    const searchValue = searchRequests.value.trim()

    if (searchValue) {
      chips.push({
        key: 'search',
        label: `Hledání: ${searchValue}`,
      })
    }

    return chips
  })

  const pageCount = computed(() => {
    return Math.max(1, Math.ceil(filteredRows.value.length / itemsPerPage.value))
  })

  const paginatedRows = computed<Row[]>(() => {
    const startIndex = (currentPage.value - 1) * itemsPerPage.value
    return filteredRows.value.slice(startIndex, startIndex + itemsPerPage.value)
  })

  const paginationLabel = computed(() => {
    return formatPaginationLabel(currentPage.value, itemsPerPage.value, filteredRows.value.length)
  })

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

  watch(filteredRows, rows => {
    if (rows.length === 0) {
      currentPage.value = 1
      return
    }

    if (currentPage.value > pageCount.value) {
      currentPage.value = pageCount.value
    }
  }, { immediate: true })

  return {
    searchRequests,
    statusFilter,
    typeFilter,
    activeFilterChips,
    filteredRows,
    itemsPerPageOptions,
    itemsPerPage,
    currentPage,
    pageCount,
    paginatedRows,
    paginationLabel,
    handleItemsPerPageChange,
    resetFilters,
    removeFilterChip,
  }
}
