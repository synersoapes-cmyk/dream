type PerfTimerOptions = {
  slowThresholdMs?: number;
  context?: Record<string, unknown>;
};

export function createPerfTimer(
  label: string,
  options: PerfTimerOptions = {}
) {
  const startedAt = Date.now();
  const marks: Record<string, number> = {};
  const slowThresholdMs = options.slowThresholdMs ?? 400;

  return {
    mark(name: string) {
      marks[name] = Date.now() - startedAt;
    },
    finish(
      extra: Record<string, unknown> = {},
      finishOptions: { force?: boolean } = {}
    ) {
      const durationMs = Date.now() - startedAt;
      if (!finishOptions.force && durationMs < slowThresholdMs) {
        return durationMs;
      }

      console.info(`[perf] ${label}`, {
        durationMs,
        ...options.context,
        ...extra,
        marks,
      });

      return durationMs;
    },
  };
}
