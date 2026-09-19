import { Minus, Plus, AlertCircle, Pill } from 'lucide-react'
import { Button } from '../ui/button'
import { MEDICINE_CATEGORIES } from '../../lib/medicine-categories'

export interface DispensingItem {
  id: string
  medicineId: string
  name: string
  strength: string
  categoryId: string
  prescribedQty: number
  dispensedQty: number
  availableStock: number
  unitPrice: number
}

export function DispensingMedicineItem({
  item,
  onChange
}: {
  item: DispensingItem
  onChange?: (id: string, qty: number) => void
}) {
  const category = MEDICINE_CATEGORIES[item.categoryId]
  const isPartial = item.dispensedQty < item.prescribedQty
  const isOutOfStock = item.availableStock === 0
  const isLowStock = item.availableStock < item.prescribedQty && item.availableStock > 0

  const handleDecrease = () => {
    if (item.dispensedQty > 0) onChange?.(item.id, item.dispensedQty - 1)
  }

  const handleIncrease = () => {
    if (item.dispensedQty < item.prescribedQty && item.availableStock > 0) {
      onChange?.(item.id, item.dispensedQty + 1)
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-start gap-3 flex-1">
        <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${category?.bgClass || 'bg-slate-100'} ${category?.textClass || 'text-slate-600'}`}>
          <Pill className="w-4 h-4" />
        </div>
        <div>
          <div className="font-semibold text-slate-900">{item.name}</div>
          <div className="text-sm text-slate-500 mt-0.5">{item.strength}</div>
          
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs font-medium text-slate-500">
              Prescribed: <span className="text-slate-900">{item.prescribedQty}</span>
            </span>
            <span className="w-1 h-1 rounded-full bg-slate-300" />
            <span className="text-xs font-medium text-slate-500">
              Stock: <span className={isOutOfStock ? "text-rose-600" : isLowStock ? "text-amber-600" : "text-emerald-600"}>{item.availableStock}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-end gap-2 shrink-0">
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="icon" 
            className="w-8 h-8 h-8 rounded-full shadow-sm" 
            onClick={handleDecrease}
            disabled={item.dispensedQty <= 0}
          >
            <Minus className="w-4 h-4" />
          </Button>
          <div className={`w-12 text-center font-bold text-lg ${isPartial ? 'text-amber-600' : 'text-slate-900'}`}>
            {item.dispensedQty}
          </div>
          <Button 
            variant="outline" 
            size="icon" 
            className="w-8 h-8 h-8 rounded-full shadow-sm" 
            onClick={handleIncrease}
            disabled={item.dispensedQty >= item.prescribedQty}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        
        {isPartial && (
          <div className="flex items-center gap-1 text-[11px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
            <AlertCircle className="w-3 h-3" />
            Partial Quantity
          </div>
        )}
      </div>
    </div>
  )
}
