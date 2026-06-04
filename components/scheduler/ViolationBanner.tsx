import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { MonthSchedule } from "@/lib/scheduler/types"

interface ViolationBannerProps {
  schedule: MonthSchedule
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

export function ViolationBanner({ schedule }: ViolationBannerProps) {
  if (!schedule.hasViolations) return null

  const entries = Object.entries(schedule.summary.violationsByDate)

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTitle>
        {schedule.summary.totalViolations} constraint violation
        {schedule.summary.totalViolations !== 1 ? "s" : ""} detected
      </AlertTitle>
      <AlertDescription>
        <ul className="mt-1 space-y-1 text-xs">
          {entries.map(([dateStr, violations]) => {
            const d = new Date(dateStr + "T00:00:00")
            const label = `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`
            return (
              <li key={dateStr}>
                <span className="font-medium">{label}:</span>{" "}
                {violations.join(" · ")}
              </li>
            )
          })}
        </ul>
      </AlertDescription>
    </Alert>
  )
}
