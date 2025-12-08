/**
 * Loading state component with skeleton UI
 * Conforms to Apps SDK loading state guidelines
 */

interface LoadingStateProps {
  count?: number;
  height?: number;
  className?: string;
}

export function LoadingState({ count = 3, height = 60, className = '' }: LoadingStateProps) {
  return (
    <div className={`space-y-4 ${className}`} role="status" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse bg-cortex-surface rounded-lg border border-cortex-border"
          style={{ height: `${height}px` }}
        />
      ))}
    </div>
  );
}

/**
 * Inline loading spinner
 */
export function LoadingSpinner({ size = 24 }: { size?: number }) {
  return (
    <div
      className="inline-block animate-spin rounded-full border-2 border-cortex-border border-t-cortex-accent"
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}
