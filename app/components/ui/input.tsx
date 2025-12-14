import * as React from "react"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={
          "flex h-11 w-full rounded-2xl border border-gray-300 bg-white px-4 py-2 text-sm " +
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

Input.displayName = "Input"
