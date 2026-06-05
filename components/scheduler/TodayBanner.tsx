"use client"

import { useTodayLeaders } from "@/hooks/useTodayLeaders"
import { cn } from "@/lib/utils"

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

const SHIFT_STYLES: Record<string, string> = {
  Morning:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  Night:
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  Overnight:
    "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
}

export function TodayBanner() {
  const { data, loading } = useTodayLeaders()

  if (loading || !data || data.noSchedule || data.teams.length === 0)
    return null

  const now = new Date()
  const dateLabel = `${DAY_NAMES[now.getDay()]}, ${now.getDate()} ${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`
  const shiftStyle = SHIFT_STYLES[data.shift] ?? ""

  return (
    <div className="mb-6 overflow-hidden rounded-lg border bg-card text-card-foreground">
      <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
        <span className="text-xs font-medium">{dateLabel}</span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
          <span className={cn("rounded px-1 py-0.5 font-semibold", shiftStyle)}>
            {data.shift}
          </span>
          shift active
        </span>
      </div>

      <div className="flex divide-x overflow-x-auto">
        {data.teams.map(({ team, members }) => (
          <div key={team.id} className="min-w-[120px] flex-1 px-3 py-2">
            <p className="mb-2 text-[0.6rem] font-semibold tracking-wider text-muted-foreground uppercase">
              {team.name}
            </p>
            <div className="flex flex-col gap-1">
              {members.length === 0 ? (
                <span className="text-xs text-muted-foreground/50">—</span>
              ) : (
                members.map((m) => (
                  <div key={m.name} className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "truncate text-xs font-medium",
                        !m.isLeader && "text-muted-foreground"
                      )}
                    >
                      {m.name}
                    </span>
                    {m.isLeader && (
                      <span className="shrink-0 rounded bg-amber-100 px-0.5 text-[0.55rem] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                        MGR
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
