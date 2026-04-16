const SIMULATOR_PENDING_REVIEW_REQUEST_KEY = 'simulator_pending_review_request';

export const SIMULATOR_OPEN_LAB_EVENT = 'simulator:open-lab';

function canUseBrowserStorage() {
  return (
    typeof window !== 'undefined' &&
    typeof window.sessionStorage !== 'undefined'
  );
}

export function saveSimulatorPendingReviewRequest(pendingId: string) {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.sessionStorage.setItem(
    SIMULATOR_PENDING_REVIEW_REQUEST_KEY,
    pendingId
  );
}

export function readSimulatorPendingReviewRequest() {
  if (!canUseBrowserStorage()) {
    return null;
  }

  return window.sessionStorage.getItem(SIMULATOR_PENDING_REVIEW_REQUEST_KEY);
}

export function clearSimulatorPendingReviewRequest() {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.sessionStorage.removeItem(SIMULATOR_PENDING_REVIEW_REQUEST_KEY);
}

export function requestSimulatorOpenPendingReview(pendingId: string) {
  saveSimulatorPendingReviewRequest(pendingId);

  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(SIMULATOR_OPEN_LAB_EVENT, {
      detail: { pendingId },
    })
  );
}
