export function TelemetrySkeleton() {
  return (
    <section
      aria-label="Loading gate telemetry"
      aria-busy="true"
      className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5"
    >
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <li
            key={i}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-16 animate-pulse rounded bg-slate-700/70" />
              <div className="h-6 w-14 animate-pulse rounded bg-slate-700/70" />
            </div>
            <div className="mt-3 h-1.5 w-full animate-pulse rounded-full bg-slate-800" />
            <div className="mt-4 h-3 w-24 animate-pulse rounded bg-slate-800" />
            <div className="mt-3 h-5 w-20 animate-pulse rounded bg-slate-800" />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ChartsSkeleton() {
  return (
    <section
      aria-label="Loading rolling metrics"
      aria-busy="true"
      className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="h-3 w-40 animate-pulse rounded bg-slate-700/70" />
        <div className="h-3 w-24 animate-pulse rounded bg-slate-800" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-56 animate-pulse rounded-xl border border-slate-800 bg-gradient-to-b from-slate-900/60 to-slate-950/60"
          />
        ))}
      </div>
    </section>
  );
}

export function ErrorBanner({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-red-400/70 bg-red-950/70 p-3 text-sm text-red-50"
    >
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        <p className="text-red-100/90">{message}</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border border-red-300/70 bg-red-500/25 px-3 py-1.5 text-xs font-semibold text-red-50 hover:bg-red-500/40"
        >
          Retry
        </button>
      )}
    </div>
  );
}
