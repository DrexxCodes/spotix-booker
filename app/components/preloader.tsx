"use client"

import Image from "next/image"

export function Preloader({ isLoading, message }: { isLoading: boolean; message?: string }) {
  return (
    <div
      className={`fixed inset-0 flex items-center justify-center bg-white z-50 transition-opacity duration-500 ${
        isLoading ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-32 h-32">
          <Image
            src="/preloader.gif"
            alt="Loading..."
            fill
            className="object-contain"
            priority
            unoptimized 
          />
        </div>
        {message && (
          <p className="text-sm text-gray-500 text-center max-w-xs px-4">{message}</p>
        )}
      </div>
    </div>
  )
}