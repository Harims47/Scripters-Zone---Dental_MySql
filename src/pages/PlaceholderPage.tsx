export function PlaceholderPage({ title, description }: { title: string, description: string }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500 mt-1">{description}</p>
        </div>
      </div>
      <div className="h-[400px] border border-dashed border-slate-300 rounded-xl flex items-center justify-center text-slate-400 bg-white">
        {title} View (Pending Implementation)
      </div>
    </div>
  )
}
