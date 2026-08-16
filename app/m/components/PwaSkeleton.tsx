export function PwaSkelLine({ className = "" }: { className?: string }) {
  return <div className={`pwa-skel h-3 ${className}`} />
}

export function PwaSkelCard({ className = "" }: { className?: string }) {
  return <div className={`pwa-skel ${className}`} />
}

export function PwaSkelAvatar({ size = 40 }: { size?: number }) {
  return (
    <div
      className="pwa-skel rounded-full"
      style={{ width: size, height: size }}
    />
  )
}
