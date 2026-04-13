const OFFLINE_ERROR_PATTERNS = [
  /failed to fetch/i,
  /load failed/i,
  /network/i,
  /internet/i,
  /offline/i,
  /err_network/i,
  /err_internet_disconnected/i,
];

export function isNavigatorOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export function isOfflineLikeError(error: unknown) {
  if (isNavigatorOffline()) {
    return true;
  }

  if (error instanceof TypeError) {
    return OFFLINE_ERROR_PATTERNS.some((pattern) => pattern.test(error.message));
  }

  if (error instanceof Error) {
    return OFFLINE_ERROR_PATTERNS.some((pattern) => pattern.test(error.message));
  }

  return false;
}

export function getSimulatorNetworkErrorMessage(
  error: unknown,
  fallback = '请求失败'
) {
  return isOfflineLikeError(error) ? '请检查网络' : fallback;
}
