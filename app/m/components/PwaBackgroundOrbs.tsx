"use client"

/**
 * Ambient background blobs, fixed behind all PWA content. Without something
 * colorful behind them, translucent/blurred glass cards just look like flat
 * white cards — this is what makes the frosted-glass effect actually read.
 * Purple-led (brand) with a soft violet/pink accent, kept low-opacity so the
 * overall page still reads as white first per the "white base" direction.
 */
export function PwaBackgroundOrbs() {
  return (
    <div className="pwa-bg-orbs" aria-hidden="true">
      <span className="pwa-orb pwa-orb--a" />
      <span className="pwa-orb pwa-orb--b" />
      <span className="pwa-orb pwa-orb--c" />
      <span className="pwa-orb pwa-orb--d" />
    </div>
  )
}
