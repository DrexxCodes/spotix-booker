/**
 * app/elections/components/Skeleton.tsx
 *
 * Shared pulsing placeholder block for the booker's election dashboard
 * loading states (list page + per-election dashboard shell).
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-gray-200 ${className}`} />
}
