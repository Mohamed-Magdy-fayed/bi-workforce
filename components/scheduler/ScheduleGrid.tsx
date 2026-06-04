"use client"

import { useState } from "react"
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

type FilterTarget =
  | { kind: "shift"; value: ShiftType }
  | { kind: "team"; value: string }
  | { kind: "role"; value: "team_leader" }
  | { kind: "dayType"; value: "friday" | "saturday" }

function filtersEqual(a: FilterTarget | null, b: FilterTarget | null): boolean {
  if (a === null && b === null) return true
  if (a === null || b === null) return false
  return a.kind === b.kind && a.value === b.value
}

interface ScheduleGridProps {
  schedule: MonthSchedule
}

export function ScheduleGrid({ schedule }: ScheduleGridProps) {
  const { year, month, days, employees, teams } = schedule
  const [activeFilter, setActiveFilter] = useState<FilterTarget | null>(null)
  const [hoverFilter, setHoverFilter] = useState<FilterTarget | null>(null)

  const effectiveFilter = hoverFilter ?? activeFilter

  const teamMap = new Map(
    teams.map((t, i) => [
      t.id,
      { name: t.name, color: TEAM_COLORS[i % TEAM_COLORS.length] },
    ])
  )
  const empMap = new Map(employees.map((e) => [e.id, e]))

  function toggleFilter(f: FilterTarget) {
    setActiveFilter((prev) => (filtersEqual(prev, f) ? null : f))
  }

  function isActive(f: FilterTarget): boolean {
    return filtersEqual(activeFilter, f)
  }

  function isEmpColDimmed(empId: string): boolean {
    if (!effectiveFilter) return false
    const emp = empMap.get(empId)
    if (!emp) return false
    if (effectiveFilter.kind === "team")
      return emp.teamId !== effectiveFilter.value
    if (effectiveFilter.kind === "role")
      return emp.role !== effectiveFilter.value
    return false
  }

  function isCellDimmed(empId: string, shift: ShiftType): boolean {
    if (!effectiveFilter) return false
    const emp = empMap.get(empId)
    if (!emp) return false
    if (effectiveFilter.kind === "shift") return shift !== effectiveFilter.value
    if (effectiveFilter.kind === "team")
      return emp.teamId !== effectiveFilter.value
    if (effectiveFilter.kind === "role")
      return emp.role !== effectiveFilter.value
    return false
  }

  function isRowDimmed(isFriday: boolean, isSaturday: boolean): boolean {
    if (!effectiveFilter || effectiveFilter.kind !== "dayType") return false
    if (effectiveFilter.value === "friday") return !isFriday
    if (effectiveFilter.value === "saturday") return !isSaturday
    return false
  }

  function mkLegend(f: FilterTarget) {
    return {
      role: "button" as const,
      tabIndex: 0,
      onMouseEnter: () => setHoverFilter(f),
      onMouseLeave: () => setHoverFilter(null),
      onClick: () => {
        toggleFilter(f)
        setHoverFilter(null)
      },
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          toggleFilter(f)
        }
      },
    }
  }

  const leaderFilter: FilterTarget = { kind: "role", value: "team_leader" }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          {MONTH_NAMES[month - 1]} {year}
        </h2>
        <div className="flex flex-wrap gap-1">
          {teams.map((t, i) => {
            const f: FilterTarget = { kind: "team", value: t.id }
            const active = isActive(f)
            return (
              <span
                key={t.id}
                className={cn(
                  "flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors select-none",
                  active
                    ? "bg-muted text-foreground ring-1 ring-ring"
                    : "hover:bg-muted/60"
                )}
                {...mkLegend(f)}
              >
                <span
                  className={cn(
                    "size-2 rounded-full",
                    TEAM_COLORS[i % TEAM_COLORS.length]
                  )}
                />
                {t.name}
              </span>
            )
          })}
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
                  const dimmed = isEmpColDimmed(emp.id)
                  const lActive = isActive(leaderFilter)
                  return (
                    <th
                      key={emp.id}
                      className={cn(
                        "min-w-22 border-r border-b px-2 py-2 text-center font-medium transition-opacity duration-150",
                        dimmed && "opacity-25"
                      )}
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
                          <span
                            className={cn(
                              "cursor-pointer rounded px-0.5 text-[0.55rem] font-normal text-amber-600 transition-colors select-none dark:text-amber-400",
                              lActive
                                ? "bg-amber-100 ring-1 ring-amber-400 dark:bg-amber-900/40"
                                : "hover:bg-amber-100/70 dark:hover:bg-amber-900/30"
                            )}
                            {...mkLegend(leaderFilter)}
                          >
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
                const rowDimmed = isRowDimmed(day.isFriday, day.isSaturday)

                return (
                  <tr
                    key={day.date}
                    className={cn(
                      "border-b transition-opacity duration-150",
                      day.isFriday && "bg-amber-50 dark:bg-amber-950/20",
                      day.isSaturday && "bg-orange-50 dark:bg-orange-950/20",
                      hasViolation && "ring-1 ring-destructive/30 ring-inset",
                      rowDimmed ? "opacity-25" : "hover:bg-muted/30"
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
                      const cellDimmed =
                        !rowDimmed && isCellDimmed(emp.id, shift)
                      return (
                        <td
                          key={emp.id}
                          className={cn(
                            "border-r px-2 py-1.5 text-center transition-opacity duration-150",
                            cellDimmed && "opacity-25"
                          )}
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
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        {(
          ["Morning", "Night", "Overnight", "Off", "Comp Off"] as ShiftType[]
        ).map((s) => {
          const f: FilterTarget = { kind: "shift", value: s }
          const active = isActive(f)
          return (
            <span
              key={s}
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-0.5 transition-colors select-none",
                active
                  ? "bg-muted text-foreground ring-1 ring-ring"
                  : "hover:bg-muted/60"
              )}
              {...mkLegend(f)}
            >
              <ScheduleCell shiftType={s} compact />
              <span>{s}</span>
            </span>
          )
        })}
        {(() => {
          const f: FilterTarget = { kind: "dayType", value: "friday" }
          const active = isActive(f)
          return (
            <span
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-0.5 transition-colors select-none",
                active
                  ? "bg-amber-100 text-foreground ring-1 ring-amber-400 dark:bg-amber-900/30"
                  : "hover:bg-muted/60"
              )}
              {...mkLegend(f)}
            >
              <span className="inline-block size-3 rounded bg-amber-50 ring-1 ring-amber-200 dark:bg-amber-950/20 dark:ring-amber-800" />
              Friday
            </span>
          )
        })()}
        {(() => {
          const f: FilterTarget = { kind: "dayType", value: "saturday" }
          const active = isActive(f)
          return (
            <span
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-0.5 transition-colors select-none",
                active
                  ? "bg-orange-100 text-foreground ring-1 ring-orange-400 dark:bg-orange-900/30"
                  : "hover:bg-muted/60"
              )}
              {...mkLegend(f)}
            >
              <span className="inline-block size-3 rounded bg-orange-50 ring-1 ring-orange-200 dark:bg-orange-950/20 dark:ring-orange-800" />
              Saturday
            </span>
          )
        })()}
      </div>
    </div>
  )
}
