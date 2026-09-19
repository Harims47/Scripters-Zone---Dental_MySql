import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border border-transparent px-2.5 py-1 text-[12px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500/50 shadow-sm",
  {
    variants: {
      variant: {
        default: "bg-teal-50 text-teal-700 hover:bg-teal-100",
        secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200",
        destructive: "bg-rose-50 text-rose-700 hover:bg-rose-100",
        outline: "border-slate-200 text-slate-700 shadow-none",
        // Semantic Premium Statuses
        statusActive: "bg-emerald-50 text-emerald-700",
        statusWaiting: "bg-amber-50 text-amber-700",
        statusWithDoctor: "bg-blue-50 text-blue-700",
        statusInactive: "bg-slate-100 text-slate-600",
        statusCancelled: "bg-rose-50 text-rose-700",
        priorityUrgent: "bg-rose-50 text-rose-700",
        priorityNormal: "bg-slate-50 text-slate-600",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
