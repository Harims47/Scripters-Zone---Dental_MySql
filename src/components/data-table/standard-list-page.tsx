import * as React from "react"
import { cn } from "../../lib/utils"

interface StandardListPageProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  description?: string
  primaryAction?: React.ReactNode
  toolbar?: React.ReactNode
  dataTable: React.ReactNode
}

export function StandardListPage({
  title,
  description,
  primaryAction,
  toolbar,
  dataTable,
  className,
  ...props
}: StandardListPageProps) {
  return (
    <div className={cn("flex flex-col space-y-6", className)} {...props}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
          {description && (
            <p className="text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        {primaryAction && <div>{primaryAction}</div>}
      </div>

      <div className="flex flex-col space-y-4">
        {toolbar && <div className="flex items-center justify-between">{toolbar}</div>}
        {dataTable}
      </div>
    </div>
  )
}
