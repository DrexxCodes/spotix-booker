"use client"

import { Preloader } from "./preloader"
import { usePageLoading } from "@/hooks/use-page-loading"

export function PreloaderWrapper() {
  const isLoading = usePageLoading()
  
  return <Preloader isLoading={isLoading} />
}