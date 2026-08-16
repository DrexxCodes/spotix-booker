import type { Metadata, Viewport } from "next"
import "./pwa.css"
import { PwaShell } from "./components/PwaShell"

// This nested metadata merges into the root layout's <head> for every route
// under /m — it adds the manifest link + PWA-specific meta without touching
// the web app's metadata.
export const metadata: Metadata = {
  title: "Spotix Booker Mobile",
  description: "Manage your Spotix events, polls, and payouts on the go.",
  manifest: "/pwa-manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Spotix Booker",
  },
  icons: {
    icon: "/logo-full.png",
    apple: "/logo-full.png",
  },
}

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
}

export default function PwaLayout({ children }: { children: React.ReactNode }) {
  return <PwaShell>{children}</PwaShell>
}
