import * as React from "react"
import { cn } from "../../lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[14px] text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 focus-visible:outline-none focus-visible:border-teal-300 focus-visible:ring-4 focus-visible:ring-teal-50 disabled:cursor-not-allowed disabled:opacity-50 hover:border-slate-300",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
