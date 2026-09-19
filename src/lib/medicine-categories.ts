export interface MedicineCategory {
  id: string
  displayName: string
  colorToken: string
  bgClass: string
  borderClass: string
  textClass: string
  dotClass: string
}

export const MEDICINE_CATEGORIES: Record<string, MedicineCategory> = {
  cat1: {
    id: "cat1",
    displayName: "Antibiotics",
    colorToken: "emerald",
    bgClass: "bg-emerald-50",
    borderClass: "border-emerald-200",
    textClass: "text-emerald-700",
    dotClass: "bg-emerald-500"
  },
  cat2: {
    id: "cat2",
    displayName: "Painkillers",
    colorToken: "rose",
    bgClass: "bg-rose-50",
    borderClass: "border-rose-200",
    textClass: "text-rose-700",
    dotClass: "bg-rose-500"
  },
  cat3: {
    id: "cat3",
    displayName: "Anesthetics",
    colorToken: "blue",
    bgClass: "bg-blue-50",
    borderClass: "border-blue-200",
    textClass: "text-blue-700",
    dotClass: "bg-blue-500"
  },
  cat4: {
    id: "cat4",
    displayName: "Antiseptics",
    colorToken: "amber",
    bgClass: "bg-amber-50",
    borderClass: "border-amber-200",
    textClass: "text-amber-700",
    dotClass: "bg-amber-500"
  },
  cat5: {
    id: "cat5",
    displayName: "Vitamins/Supplements",
    colorToken: "purple",
    bgClass: "bg-purple-50",
    borderClass: "border-purple-200",
    textClass: "text-purple-700",
    dotClass: "bg-purple-500"
  },
  cat6: {
    id: "cat6",
    displayName: "Consumables",
    colorToken: "slate",
    bgClass: "bg-slate-50",
    borderClass: "border-slate-200",
    textClass: "text-slate-700",
    dotClass: "bg-slate-500"
  },
}
