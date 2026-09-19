import * as React from "react"
import { cn } from "../../lib/utils"

export interface PatientIdentityProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string
  patientId?: string
  phone?: string
  avatarUrl?: string
  size?: "sm" | "default" | "lg"
}

export function PatientIdentity({
  name,
  patientId,
  phone,
  avatarUrl,
  size = "default",
  className,
  ...props
}: PatientIdentityProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase()

  const sizeClasses = {
    sm: {
      avatar: "h-8 w-8 text-xs",
      name: "text-sm",
      meta: "text-xs",
      gap: "gap-2"
    },
    default: {
      avatar: "h-10 w-10 text-sm",
      name: "text-sm",
      meta: "text-xs",
      gap: "gap-3"
    },
    lg: {
      avatar: "h-14 w-14 text-lg border-2 border-primary/10",
      name: "text-lg",
      meta: "text-sm",
      gap: "gap-4"
    }
  }

  return (
    <div className={cn("flex items-center", sizeClasses[size].gap, className)} {...props}>
      <div 
        className={cn(
          "shrink-0 rounded-md bg-primary/10 text-primary flex items-center justify-center font-semibold tracking-wider",
          sizeClasses[size].avatar
        )}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="h-full w-full rounded-md object-cover" />
        ) : (
          initials
        )}
      </div>
      <div className="flex flex-col min-w-0">
        <span className={cn("font-medium truncate text-foreground", sizeClasses[size].name)}>
          {name}
        </span>
        {(phone || patientId) && (
          <div className={cn("flex items-center text-muted-foreground truncate", sizeClasses[size].meta)}>
            {patientId && <span className="font-mono">{patientId}</span>}
            {patientId && phone && <span className="mx-1.5 opacity-50">•</span>}
            {phone && <span>{phone}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
