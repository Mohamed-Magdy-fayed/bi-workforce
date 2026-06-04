import { cn } from "@/lib/utils"
import type { ShiftType } from "@/lib/scheduler/types"

const SHIFT_STYLES: Record<ShiftType, string> = {
  Morning: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  Night: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  Overnight: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  Off: "bg-muted text-muted-foreground",
  "Comp Off": "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
}

const SHIFT_ABBR: Record<ShiftType, string> = {
  Morning: "MOR",
  Night: "NGT",
  Overnight: "OVN",
  Off: "OFF",
  "Comp Off": "CMP",
}

interface ScheduleCellProps {
  shiftType: ShiftType
  compact?: boolean
}

export function ScheduleCell({ shiftType, compact }: ScheduleCellProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[0.6rem] font-semibold tracking-wide",
        SHIFT_STYLES[shiftType],
        compact ? "w-10" : "w-14",
      )}
    >
      {compact ? SHIFT_ABBR[shiftType] : shiftType}
    </span>
  )
}
