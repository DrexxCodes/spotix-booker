import * as React from "react"

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = "", ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={
          "w-full min-h-[90px] rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm " +
          "placeholder:text-gray-400 shadow-sm " +
          "focus:outline-none focus:ring-2 focus:ring-[#6b2fa5] focus:border-[#6b2fa5] " +
          "disabled:cursor-not-allowed disabled:opacity-60 " +
          className
        }
        {...props}
      />
    )
  }
)

Textarea.displayName = "Textarea"
