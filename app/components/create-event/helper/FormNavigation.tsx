import React from "react"
import { ChevronLeft, ChevronRight, Sparkles, Upload } from "lucide-react"

interface FormNavigationProps {
  currentStep: number
  totalSteps: number
  onNext: () => void
  onPrevious: () => void
  onSubmit: () => void
  isSubmitting: boolean
  isUploading: boolean
  canProceed: boolean
}

export function FormNavigation({
  currentStep,
  totalSteps,
  onNext,
  onPrevious,
  onSubmit,
  isSubmitting,
  isUploading,
  canProceed,
}: FormNavigationProps) {
  const isLastStep = currentStep === totalSteps

  return (
    <div className="flex items-center justify-between gap-4">
      {/* Previous Button */}
      {currentStep > 1 && (
        <button
          type="button"
          onClick={onPrevious}
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 px-6 py-3 border-2 border-slate-300 hover:border-[#6b2fa5] text-slate-700 hover:text-[#6b2fa5] font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-5 h-5" />
          Previous
        </button>
      )}

      {/* Step Indicator */}
      <div className="flex-1 flex items-center justify-center gap-2">
        {Array.from({ length: totalSteps }).map((_, index) => (
          <div
            key={index}
            className={`h-2 rounded-full transition-all duration-300 ${
              index + 1 === currentStep
                ? "w-8 bg-[#6b2fa5]"
                : index + 1 < currentStep
                  ? "w-2 bg-[#6b2fa5]/50"
                  : "w-2 bg-slate-300"
            }`}
          />
        ))}
      </div>

      {/* Next/Submit Button */}
      {!isLastStep ? (
        <button
          type="button"
          onClick={onNext}
          disabled={!canProceed || isSubmitting}
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#6b2fa5] hover:bg-[#5a2589] text-white font-semibold rounded-lg transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
          <ChevronRight className="w-5 h-5" />
        </button>
      ) : (
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting || isUploading || !canProceed}
          className="group inline-flex items-center justify-center gap-3 px-8 py-3 bg-gradient-to-r from-[#6b2fa5] to-purple-600 hover:from-[#5a2589] hover:to-[#6b2fa5] text-white font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-[#6b2fa5]/30 hover:shadow-xl hover:shadow-[#6b2fa5]/40 hover:-translate-y-0.5 active:translate-y-0"
        >
          {isSubmitting ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Creating Event...
            </>
          ) : isUploading ? (
            <>
              <Upload className="w-5 h-5 animate-pulse" />
              Uploading Images...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              Create Event
            </>
          )}
        </button>
      )}
    </div>
  )
}