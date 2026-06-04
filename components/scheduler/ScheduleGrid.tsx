"use client"

import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type { MonthSchedule, ShiftType } from "@/lib/scheduler/types"
import { ScheduleCell } from "./ScheduleCell"

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

const TEAM_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-orange-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-cyan-500",
]

interface ScheduleGridProps {
  schedule: MonthSchedule
}

export function ScheduleGrid({ schedule }: ScheduleGridProps) {
  const { year, month, days, employees, teams } = schedule
  const teamMap = new Map(
    teams.map((t, i) => [
      t.id,
      { name: t.name, color: TEAM_COLORS[i % TEAM_COLORS.length] },
    ])
  )
  const empMap = new Map(employees.map((e) => [e.id, e]))

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          {MONTH_NAMES[month - 1]} {year}
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {teams.map((t, i) => (
            <span
              key={t.id}
              className="flex items-center gap-1 text-xs text-muted-foreground"
            >
              <span
                className={cn(
                  "size-2 rounded-full",
                  TEAM_COLORS[i % TEAM_COLORS.length]
                )}
              />
              {t.name}
            </span>
          ))}
        </div>
      </div>

      <ScrollArea className="w-full rounded-md border">
        <div className="min-w-max">
          <table className="border-collapse text-xs">
            <thead>
              <tr className="bg-muted/50">
                <th className="sticky left-0 z-10 min-w-[100px] border-r border-b bg-muted/50 px-3 py-2 text-left font-medium text-muted-foreground">
                  Date
                </th>
                {employees.map((emp) => {
                  const team = teamMap.get(emp.teamId)
                  return (
                    <th
                      key={emp.id}
                      className="min-w-[88px] border-r border-b px-2 py-2 text-center font-medium"
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <span>{emp.name}</span>
                        {team && (
                          <span className="flex items-center gap-1 text-[0.55rem] font-normal text-muted-foreground">
                            <span
                              className={cn(
                                "size-1.5 rounded-full",
                                team.color
                              )}
                            />
                            {team.name}
                          </span>
                        )}
                        {emp.role === "team_leader" && (
                          <span className="text-[0.55rem] font-normal text-amber-600 dark:text-amber-400">
                            Leader
                          </span>
                        )}
                      </div>
                    </th>
                  )
                })}
                <th className="min-w-[64px] border-b px-2 py-2 text-center font-medium text-muted-foreground">
                  Reg. Off
                </th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => {
                const d = new Date(day.date + "T00:00:00")
                const label = `${DAY_NAMES[day.dayOfWeek]} ${d.getDate()}`
                const hasViolation = day.violatedConstraints.length > 0

                return (
                  <tr
                    key={day.date}
                    className={cn(
                      "border-b transition-colors hover:bg-muted/30",
                      day.isFriday && "bg-amber-50 dark:bg-amber-950/20",
                      day.isSaturday && "bg-orange-50 dark:bg-orange-950/20",
                      hasViolation && "ring-1 ring-destructive/30 ring-inset"
                    )}
                  >
                    <td
                      className={cn(
                        "sticky left-0 z-10 border-r px-3 py-1.5 font-medium",
                        day.isFriday && "bg-amber-50 dark:bg-amber-950/20",
                        day.isSaturday && "bg-orange-50 dark:bg-orange-950/20",
                        !day.isFriday && !day.isSaturday && "bg-background",
                        hasViolation && "text-destructive"
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        {hasViolation && (
                          <span
                            className="size-1.5 rounded-full bg-destructive"
                            title={day.violatedConstraints.join(", ")}
                          />
                        )}
                        {label}
                      </div>
                    </td>
                    {employees.map((emp) => {
                      const assignment = day.assignments.find(
                        (a) => a.employeeId === emp.id
                      )
                      const shift = (assignment?.shiftType ??
                        "Off") as ShiftType
                      return (
                        <td
                          key={emp.id}
                          className="border-r px-2 py-1.5 text-center"
                        >
                          <ScheduleCell shiftType={shift} compact />
                        </td>
                      )
                    })}
                    {(() => {
                      const isNormal = !day.isFriday && !day.isSaturday
                      if (!isNormal) {
                        return (
                          <td className="px-2 py-1.5 text-center text-muted-foreground">
                            —
                          </td>
                        )
                      }
                      const regularsOff = day.assignments.filter((a) => {
                        const emp = empMap.get(a.employeeId)
                        return (
                          emp?.role === "regular" &&
                          (a.shiftType === "Off" || a.shiftType === "Comp Off")
                        )
                      }).length
                      return (
                        <td
                          className={cn(
                            "px-2 py-1.5 text-center font-medium",
                            regularsOff === 0 &&
                              "text-emerald-600 dark:text-emerald-400",
                            regularsOff === 1 &&
                              "text-amber-600 dark:text-amber-400",
                            regularsOff >= 2 && "text-destructive"
                          )}
                        >
                          {regularsOff}
                        </td>
                      )
                    })()}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
        {(
          ["Morning", "Night", "Overnight", "Off", "Comp Off"] as ShiftType[]
        ).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <ScheduleCell shiftType={s} compact />
            <span>{s}</span>
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded bg-amber-50 ring-1 ring-amber-200 dark:bg-amber-950/20 dark:ring-amber-800" />
          Friday
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded bg-orange-50 ring-1 ring-orange-200 dark:bg-orange-950/20 dark:ring-orange-800" />
          Saturday
        </span>
      </div>
    </div>
  )
}
