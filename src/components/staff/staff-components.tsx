import { Check, X } from 'lucide-react'
import { Badge } from '../ui/badge'
import { ROLE_CONFIG, SIDEBAR_MODULES, type ClinicRole, type ClinicModule } from '../../lib/role-config'

export function StaffStatusBadge({ status }: { status: 'Active' | 'Inactive' }) {
  if (status === 'Active') {
    return <Badge variant="statusActive"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" /> Active</Badge>
  }
  return <Badge variant="statusInactive"><span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5" /> Inactive</Badge>
}

export interface ModuleAccessEditorProps {
  role: ClinicRole
  selectedPermissions?: ClinicModule[]
  onChange?: (permissions: ClinicModule[]) => void
  readOnly?: boolean
}

export function ModuleAccessEditor({
  role,
  selectedPermissions = [],
  onChange,
  readOnly = false
}: ModuleAccessEditorProps) {
  const config = ROLE_CONFIG[role] || ROLE_CONFIG['Duty Doctor']
  const roleBaseline = config.permissions

  const handleToggle = (moduleName: ClinicModule) => {
    if (readOnly || !onChange) return

    if (selectedPermissions.includes(moduleName)) {
      onChange(selectedPermissions.filter(m => m !== moduleName))
    } else {
      onChange([...selectedPermissions, moduleName])
    }
  }

  const handleSelectRoleDefaults = () => {
    if (readOnly || !onChange) return
    const sidebarDefaults = SIDEBAR_MODULES.filter(m => roleBaseline.includes(m))
    onChange([...sidebarDefaults])
  }

  const handleClearAll = () => {
    if (readOnly || !onChange) return
    onChange([])
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-100/60 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Module Access Control</h4>
          <p className="text-xs text-slate-500 mt-0.5">
            {readOnly ? 'Active sidebar modules for this staff member.' : 'Configure accessible sidebar modules for this staff member.'}
          </p>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectRoleDefaults}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 transition-colors"
            >
              Role Defaults
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="text-xs text-slate-500 hover:text-slate-700 font-medium px-2 py-1 rounded bg-slate-200/60 hover:bg-slate-200 transition-colors"
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {SIDEBAR_MODULES.map(mod => {
            const isChecked = selectedPermissions.includes(mod)

            // Display title matches sidebar label
            const displayTitle = mod === 'Staff Management' ? 'Staff' : mod
            const testId = `module-access-${mod.toLowerCase().replace(/\s+/g, '-')}`

            if (readOnly) {
              return (
                <div
                  key={mod}
                  data-testid={testId}
                  className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition-colors ${
                    isChecked
                      ? 'bg-white border-emerald-200 text-slate-800'
                      : 'bg-white border-slate-200 text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isChecked ? (
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <X className="w-4 h-4 text-slate-300 shrink-0" />
                    )}
                    <span className={isChecked ? 'font-medium text-slate-800 text-[13px]' : 'text-slate-400 text-[13px]'}>
                      {displayTitle}
                    </span>
                  </div>
                </div>
              )
            }

            return (
              <label
                key={mod}
                data-testid={testId}
                className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer select-none transition-colors ${
                  isChecked
                    ? 'bg-white border-indigo-200 shadow-xs hover:border-indigo-300'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    name={`module_${mod}`}
                    checked={isChecked}
                    onChange={() => handleToggle(mod)}
                    className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                  />
                  <span className={`text-[13px] ${isChecked ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                    {displayTitle}
                  </span>
                </div>
              </label>
            )
          })}
        </div>

        <div className="mt-3 text-[11px] text-slate-500 bg-slate-100/80 p-2 rounded-lg border border-slate-200/60 leading-relaxed">
          <strong>Access Rule:</strong> Unchecking a module removes it from the user's sidebar and denies access.
        </div>
      </div>
    </div>
  )
}

export function RoleAccessPreview({ role }: { role: ClinicRole }) {
  const config = ROLE_CONFIG[role] || ROLE_CONFIG['Duty Doctor']
  return (
    <ModuleAccessEditor
      role={role}
      selectedPermissions={config.permissions}
      readOnly={true}
    />
  )
}

