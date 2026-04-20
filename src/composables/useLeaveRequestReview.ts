import { computed, ref, type Ref } from 'vue'
import { reviewLeaveRequest } from '@/services/mock/leaveRequestsService'
import type { LeaveRequest, ReviewLeaveRequestInput } from '@/types/leave'

type ReviewAction = ReviewLeaveRequestInput['status']

type ReviewState = {
  action: ReviewAction | null
  rejectionReason: string
}

type UseLeaveRequestReviewOptions = {
  leaveRequests: Ref<LeaveRequest[]>
  submitReviewRequest?: (requestId: string, payload: ReviewLeaveRequestInput) => Promise<LeaveRequest>
  submitErrorMessage?: string
  getInitialState?: (request: LeaveRequest | undefined) => ReviewState
}

const defaultReviewState: ReviewState = {
  action: null,
  rejectionReason: '',
}

export function useLeaveRequestReview (options: UseLeaveRequestReviewOptions) {
  const {
    leaveRequests,
    submitReviewRequest = reviewLeaveRequest,
    submitErrorMessage = 'Posouzení se nepodařilo uložit.',
    getInitialState,
  } = options

  const dialogVisible = ref(false)
  const reviewAction = ref<ReviewAction | null>(null)
  const rejectionReason = ref('')
  const selectedRequestId = ref<string | null>(null)
  const isSavingReview = ref(false)
  const reviewError = ref<string | null>(null)

  const selectedRequest = computed<LeaveRequest | null>(() => {
    if (!selectedRequestId.value) {
      return null
    }

    return leaveRequests.value.find(request => request.id === selectedRequestId.value) ?? null
  })

  const isRejectAction = computed(() => reviewAction.value === 'rejected')

  const reviewFormValid = computed(() => {
    if (!reviewAction.value) {
      return false
    }

    return reviewAction.value === 'approved' || rejectionReason.value.trim().length > 0
  })

  function openDialog (requestId: string): void {
    const request = leaveRequests.value.find(item => item.id === requestId)
    const initialState = getInitialState?.(request) ?? defaultReviewState

    selectedRequestId.value = requestId
    reviewAction.value = initialState.action
    rejectionReason.value = initialState.rejectionReason
    reviewError.value = null
    dialogVisible.value = true
  }

  function closeDialog (): void {
    dialogVisible.value = false
    selectedRequestId.value = null
    reviewAction.value = null
    rejectionReason.value = ''
    reviewError.value = null
  }

  async function submitReview (): Promise<void> {
    const currentRequestId = selectedRequestId.value
    const currentReviewAction = reviewAction.value

    if (!currentRequestId || !currentReviewAction) {
      return
    }

    isSavingReview.value = true
    reviewError.value = null

    try {
      const updatedRequest = await submitReviewRequest(currentRequestId, {
        status: currentReviewAction,
        rejectionReason: currentReviewAction === 'rejected' ? rejectionReason.value.trim() : null,
      })

      leaveRequests.value = leaveRequests.value.map(request => {
        return request.id === updatedRequest.id ? updatedRequest : request
      })

      closeDialog()
    } catch (error) {
      reviewError.value = error instanceof Error
        ? error.message
        : submitErrorMessage
    } finally {
      isSavingReview.value = false
    }
  }

  return {
    dialogVisible,
    reviewAction,
    rejectionReason,
    selectedRequestId,
    selectedRequest,
    isSavingReview,
    reviewError,
    isRejectAction,
    reviewFormValid,
    openDialog,
    closeDialog,
    submitReview,
  }
}
