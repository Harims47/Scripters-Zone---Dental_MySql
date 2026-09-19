import * as React from "react"
import { useDraggable, useDroppable } from "@dnd-kit/core"
import { GripVertical, Plus, Minus, Trash2 } from "lucide-react"
import { cn } from "../../lib/utils"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { MEDICINE_CATEGORIES } from "../../lib/medicine-categories"
import { type Medicine } from "../../lib/mock-data"

export interface PrescriptionLineItem extends Medicine {
  quantity: number
  dosage?: string
  frequency?: string
  duration?: string
  instructions?: string
  customInstructions?: string
}

export function MedicineCategoryBadge({ categoryId, categoryName }: { categoryId: string; categoryName?: string }) {
  const cat = MEDICINE_CATEGORIES[categoryId]
  if (cat) {
    return (
      <Badge variant="outline" className={cn(cat.bgClass, cat.textClass, cat.borderClass, "font-medium text-[10px] shadow-sm uppercase tracking-wider")}>
        <span className={cn("w-1.5 h-1.5 rounded-full mr-1.5", cat.dotClass)} />
        {cat.displayName}
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 font-medium text-[10px] shadow-xs uppercase tracking-wider">
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-slate-400" />
      {categoryName || categoryId}
    </Badge>
  )
}

export function DraggableMedicineItem({ medicine, onAdd }: { medicine: Medicine, onAdd?: (med: Medicine) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: medicine.id,
    data: medicine,
  })

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-start p-3 bg-white border rounded-lg cursor-grab hover:border-primary/50 transition-colors shadow-sm select-none",
        isDragging && "opacity-50 border-primary ring-2 ring-primary/20 cursor-grabbing z-50"
      )}
    >
      <div {...listeners} {...attributes} className="cursor-grab hover:text-slate-500 mr-2 shrink-0 flex items-center justify-center p-1 -ml-1">
        <GripVertical className="h-4 w-4 text-slate-300 mt-1" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-slate-900 text-sm leading-tight mb-1">{medicine.name}</div>
        <div className="text-xs text-slate-500 mb-2">{medicine.unit}</div>
        <MedicineCategoryBadge categoryId={medicine.categoryId} />
      </div>
      {onAdd && (
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 shrink-0 text-teal-600 hover:text-teal-700 hover:bg-teal-50 ml-2" 
          onClick={(e) => {
            e.stopPropagation();
            onAdd(medicine);
          }}
        >
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      )}
    </div>
  )
}

export function PrescriptionDropZone({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'prescription-dropzone',
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-1 flex flex-col rounded-xl border-2 transition-colors min-h-[400px] p-4 overflow-y-auto",
        isOver ? "border-primary bg-primary/5 border-dashed" : "border-transparent bg-slate-50/80"
      )}
    >
      {children}
    </div>
  )
}

export function PrescriptionRow({ 
  item, 
  onUpdateField, 
  onRemove 
}: { 
  item: PrescriptionLineItem, 
  onUpdateField: (id: string, field: keyof PrescriptionLineItem, value: any) => void,
  onRemove: (id: string) => void 
}) {
  return (
    <div className="flex flex-col p-4 bg-white border rounded-xl shadow-sm gap-4">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-900 text-sm leading-tight mb-1">
            {item.name} <span className="text-slate-500 font-normal ml-1">{item.unit}</span>
          </div>
          <MedicineCategoryBadge categoryId={item.categoryId} />
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 -mt-1 -mr-1" onClick={() => onRemove(item.id)}>
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Remove medicine</span>
        </Button>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-500 uppercase">Quantity</label>
          <div className="flex items-center gap-1 border rounded-md bg-slate-50 p-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 text-slate-500 hover:text-slate-900 shrink-0"
              onClick={() => onUpdateField(item.id, 'quantity', Math.max(1, item.quantity - 1))}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <Input 
              className="w-full h-7 text-center font-semibold border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-0"
              value={item.quantity}
              onChange={(e) => {
                const val = parseInt(e.target.value)
                if (!isNaN(val) && val >= 1) onUpdateField(item.id, 'quantity', val)
              }}
            />
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 text-slate-500 hover:text-slate-900 shrink-0"
              onClick={() => onUpdateField(item.id, 'quantity', item.quantity + 1)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-500 uppercase">Dosage</label>
          <Input 
            className="h-9 bg-slate-50/50" 
            placeholder="e.g. 1 tablet" 
            value={item.dosage || ''}
            onChange={(e) => onUpdateField(item.id, 'dosage', e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-500 uppercase">Frequency</label>
          <Input 
            className="h-9 bg-slate-50/50" 
            placeholder="e.g. Twice daily" 
            value={item.frequency || ''}
            onChange={(e) => onUpdateField(item.id, 'frequency', e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-500 uppercase">Duration</label>
          <Input 
            className="h-9 bg-slate-50/50" 
            placeholder="e.g. 5 days" 
            value={item.duration || ''}
            onChange={(e) => onUpdateField(item.id, 'duration', e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-500 uppercase">Instructions</label>
          <Input 
            className="h-9 bg-slate-50/50" 
            placeholder="e.g. After food" 
            value={item.instructions || ''}
            onChange={(e) => onUpdateField(item.id, 'instructions', e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
