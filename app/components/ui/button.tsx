import * as React from "react"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost"
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "default", ...props }, ref) => {
    let styles =
      "inline-flex items-center justify-center whitespace-nowrap rounded-2xl px-4 py-2 " +
      "text-sm font-semibold transition-all shadow-sm disabled:opacity-50 "

    if (variant === "default") {
      styles +=
        "bg-[#6b2fa5] text-white hover:bg-[#5b2490] active:scale-[0.97] disabled:bg-purple-300 "
    }

    if (variant === "outline") {
      styles +=
        "border border-gray-300 text-gray-700 bg-white hover:border-[#6b2fa5] hover:text-[#6b2fa5] "
    }

    if (variant === "ghost") {
      styles += "text-gray-700 hover:bg-gray-100 "
    }

    return (
      <button
        ref={ref}
        className={styles + className}
        {...props}
      />
    )
  }
)

Button.displayName = "Button"
