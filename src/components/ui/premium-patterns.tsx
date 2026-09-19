import { cn } from '../../lib/utils'

export function PatientIdentity({ name, id, phone, size = 'default' }: { name: string, id: string, phone: string, size?: 'sm' | 'default' | 'lg' }) {
  const avatarSize = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-14 h-14 text-xl' : 'w-10 h-10 text-sm'
  const titleSize = size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-xl font-bold' : 'text-[15px] font-semibold'
  const metaSize = size === 'sm' ? 'text-[11px]' : size === 'lg' ? 'text-sm' : 'text-[12px]'

  return (
    <div className="flex items-center gap-3.5">
      <div className={cn("rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold shrink-0 ring-1 ring-slate-200/50 shadow-inner", avatarSize)}>
        {name.substring(0, 2).toUpperCase()}
      </div>
      <div className="flex flex-col justify-center">
        <span className={cn("text-slate-900 leading-tight tracking-tight", titleSize)}>{name}</span>
        <div className={cn("text-slate-500 font-medium tracking-wide flex items-center gap-1.5 mt-0.5", metaSize)}>
          <span className="text-slate-400">{id}</span>
          <span className="w-1 h-1 rounded-full bg-slate-300" />
          <span>{phone}</span>
        </div>
      </div>
    </div>
  )
}

export function PremiumStatus({ status }: { status: string }) {
  const config: Record<string, { bg: string, text: string, dot: string }> = {
    'Waiting': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
    'With Doctor': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    'Scheduled': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
    'Active': { bg: 'bg-slate-50', text: 'text-slate-700', dot: 'bg-slate-400' },
    'Completed': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    'Cancelled': { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' },
    'Pending': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
    'Paid': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    'Low Stock': { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' },
    'Out of Stock': { bg: 'bg-rose-100', text: 'text-rose-800', dot: 'bg-rose-600' },
  }
  const c = config[status] || config['Active']
  
  return (
    <div className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-semibold border border-transparent shadow-sm", c.bg, c.text)}>
      <span className={cn("w-1.5 h-1.5 rounded-full mr-1.5 shadow-[0_0_4px_rgba(0,0,0,0.1)]", c.dot)} />
      {status}
    </div>
  )
}
