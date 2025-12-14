"use client"

export function Preloader({ isLoading }: { isLoading: boolean }) {
  return (
    <div
      className={`fixed inset-0 flex items-center justify-center bg-background z-50 transition-opacity duration-300 ${
        isLoading ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-4 border-muted border-t-primary animate-spin" />
        <div
          className="absolute inset-2 rounded-full border-2 border-transparent border-r-accent animate-spin"
          style={{ animationDirection: "reverse", animationDuration: "2s" }}
        />
      </div>
    </div>
  )
}
