"use client"

import { PreloaderWrapper } from "./preloader-wrapper"
import { Footer } from "./footer"

export function ClientLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PreloaderWrapper />
      {children}
      <Footer />
    </>
  )
}
