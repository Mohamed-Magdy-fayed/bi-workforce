"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { createPortal } from "react-dom"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type { MonthSchedule, ShiftType, EditMap } from "@/lib/scheduler/types"
import { validateDay } from "@/lib/scheduler/rules"
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

const SHIFT_TYPES: ShiftType[] = [
  "Morning",
  "Night",
  "Overnight",
  "Off",
  "Comp Off",
]

type FilterTarget =
  | { kind: "shift"; value: ShiftType }
  | { kind: "team"; value: string }
  | { kind: "role"; value: "team_leader" }
  | { kind: "dayType"; value: "friday" | "saturday" }
  | { kind: "employee"; value: string }

function filtersEqual(a: FilterTarget | null, b: FilterTarget | null): boolean {
  if (a === null && b === null) return true
  if (a === null || b === null) return false
  return a.kind === b.kind && a.value === b.value
}

interface SwapSource {
  date: string
  employeeId: string
}

// ---------------------------------------------------------------------------
// Cell dropdown — rendered into a portal to avoid overflow clipping
// ---------------------------------------------------------------------------
interface CellDropdownProps {
  currentShift: ShiftType
  isEdited: boolean
  isViolated: boolean
  isSwapSource: boolean
  swapMode: boolean
  sameDay: boolean // is this cell on the same date as the swap source?
  onPickShift: (s: ShiftType) => void
  onStartSwap: () => void
  onCellClick: () => void // called when in swap mode
}

function CellDropdown({
  currentShift,
  isEdited,
  isViolated,
  isSwapSource,
  swapMode,
  sameDay,
  onPickShift,
  onStartSwap,
  onCellClick,
}: CellDropdownProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function close() {
      setOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [open])

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (swapMode) {
      onCellClick()
      return
    }
    const rect = btnRef.current!.getBoundingClientRect()
    const left = Math.min(rect.left, window.innerWidth - 160)
    setPos({ top: rect.bottom + 2, left })
    setOpen(true)
  }

  const ringClass = isSwapSource
    ? "ring-2 ring-blue-500 ring-offset-1"
    : isEdited
      ? isViolated
        ? "ring-1 ring-destructive"
        : "ring-1 ring-blue-400"
      : ""

  const cursorClass = swapMode
    ? sameDay
      ? "cursor-pointer hover:opacity-80"
      : "cursor-not-allowed opacity-50"
    : "cursor-pointer hover:opacity-80"

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleClick}
        className={cn("rounded transition-all", ringClass, cursorClass)}
        title={
          swapMode
            ? sameDay
              ? "Click to swap"
              : "Can only swap on the same day"
            : undefined
        }
      >
        <ScheduleCell shiftType={currentShift} compact />
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              zIndex: 9999,
            }}
            className="min-w-37 rounded-md border bg-background py-1 shadow-lg"
          >
            {SHIFT_TYPES.map((s) => (
              <button
                key={s}
                className={cn(
                  "flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-muted",
                  s === currentShift && "font-semibold"
                )}
                onClick={() => {
                  onPickShift(s)
                  setOpen(false)
                }}
              >
                <ScheduleCell shiftType={s} compact />
                {s}
              </button>
            ))}
            <div className="my-1 border-t" />
            <button
              className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs text-blue-600 hover:bg-muted dark:text-blue-400"
              onClick={() => {
                onStartSwap()
                setOpen(false)
              }}
            >
              <span>⇄</span>
              Swap with…
            </button>
          </div>,
          document.body
        )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Main grid
// ---------------------------------------------------------------------------
interface ScheduleGridProps {
  schedule: MonthSchedule
  editMap?: EditMap
  onCellEdit?: (date: string, employeeId: string, newShift: ShiftType) => void
}

export function ScheduleGrid({
  schedule,
  editMap,
  onCellEdit,
}: ScheduleGridProps) {
  const { year, month, days, employees, teams } = schedule
  const [activeFilter, setActiveFilter] = useState<FilterTarget | null>(null)
  const [hoverFilter, setHoverFilter] = useState<FilterTarget | null>(null)
  const [swapSource, setSwapSource] = useState<SwapSource | null>(null)

  const editable = !!onCellEdit

  // Cancel swap on Escape
  useEffect(() => {
    if (!swapSource) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSwapSource(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [swapSource])

  const effectiveFilter = hoverFilter ?? activeFilter

  const teamMap = new Map(
    teams.map((t, i) => [
      t.id,
      { name: t.name, color: TEAM_COLORS[i % TEAM_COLORS.length] },
    ])
  )
  const empMap = new Map(employees.map((e) => [e.id, e]))

  function getEffectiveShift(
    date: string,
    employeeId: string,
    original: ShiftType
  ): ShiftType {
    return editMap?.[`${date}::${employeeId}`] ?? original
  }

  // Re-validate all days using effective assignments
  const effectiveViolations = useMemo(() => {
    const result: Record<string, string[]> = {}
    for (const day of days) {
      if (!editMap || Object.keys(editMap).length === 0) {
        result[day.date] = day.violatedConstraints
        continue
      }
      const effectiveAssignments = day.assignments.map((a) => ({
        ...a,
        shiftType: editMap[`${day.date}::${a.employeeId}`] ?? a.shiftType,
      }))
      result[day.date] = validateDay(
        { ...day, assignments: effectiveAssignments },
        employees,
        teams
      )
    }
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, employees, teams, editMap])

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
    if (effectiveFilter.kind === "employee")
      return emp.id !== effectiveFilter.value
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
    if (effectiveFilter.kind === "employee")
      return emp.id !== effectiveFilter.value
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

  function handleCellClick(date: string, employeeId: string) {
    if (!swapSource) return
    if (swapSource.date === date && swapSource.employeeId !== employeeId) {
      // Complete the swap
      const srcOriginal =
        (days
          .find((d) => d.date === swapSource.date)
          ?.assignments.find((a) => a.employeeId === swapSource.employeeId)
          ?.shiftType as ShiftType) ?? "Off"
      const tgtOriginal =
        (days
          .find((d) => d.date === date)
          ?.assignments.find((a) => a.employeeId === employeeId)
          ?.shiftType as ShiftType) ?? "Off"

      const srcEffective =
        editMap?.[`${swapSource.date}::${swapSource.employeeId}`] ?? srcOriginal
      const tgtEffective = editMap?.[`${date}::${employeeId}`] ?? tgtOriginal

      onCellEdit?.(swapSource.date, swapSource.employeeId, tgtEffective)
      onCellEdit?.(date, employeeId, srcEffective)
    }
    setSwapSource(null)
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

      {/* Swap mode banner */}
      {swapSource && (
        <div className="mb-2 flex items-center gap-2 rounded-md bg-blue-50 px-3 py-1.5 text-xs text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
          <span>⇄</span>
          <span>
            Select another employee on the same day to complete the swap, or
          </span>
          <button
            className="font-medium underline"
            onClick={() => setSwapSource(null)}
          >
            cancel (Esc)
          </button>
        </div>
      )}

      <ScrollArea className="w-full rounded-md border">
        <div className="min-w-max">
          <table className="border-collapse text-xs">
            <thead>
              <tr className="bg-muted/50">
                <th className="sticky left-0 z-10 min-w-25 border-r border-b bg-muted px-2 py-1 text-left font-medium text-muted-foreground">
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
                        "min-w-22 border-r border-b px-1 py-1 text-center font-medium transition-opacity duration-150",
                        dimmed && "opacity-25"
                      )}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <span
                          className={cn(
                            "cursor-pointer rounded px-0.5 transition-colors select-none",
                            isActive({ kind: "employee", value: emp.id })
                              ? "bg-muted text-foreground ring-1 ring-ring"
                              : "hover:bg-muted/60"
                          )}
                          {...mkLegend({ kind: "employee", value: emp.id })}
                        >
                          {emp.name}
                        </span>
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
                <th className="min-w-16 border-b px-1 py-1 text-center font-medium text-muted-foreground">
                  Reg. Off
                </th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => {
                const d = new Date(day.date + "T00:00:00")
                const label = `${DAY_NAMES[day.dayOfWeek]} ${d.getDate()}`
                const dayViolations = effectiveViolations[day.date] ?? []
                const hasViolation = dayViolations.length > 0
                const rowDimmed = isRowDimmed(day.isFriday, day.isSaturday)
                const dayHasEdits =
                  editMap &&
                  employees.some((emp) => `${day.date}::${emp.id}` in editMap)

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
                        "sticky left-0 z-10 border-r px-2 py-1 font-medium",
                        day.isFriday && "bg-amber-50 dark:bg-amber-950",
                        day.isSaturday && "bg-orange-50 dark:bg-orange-950",
                        !day.isFriday && !day.isSaturday && "bg-background",
                        hasViolation && "text-destructive"
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        {hasViolation && (
                          <span
                            className="size-1.5 rounded-full bg-destructive"
                            title={dayViolations.join(", ")}
                          />
                        )}
                        {dayHasEdits && !hasViolation && (
                          <span
                            className="size-1.5 rounded-full bg-blue-400"
                            title="Day has manual edits"
                          />
                        )}
                        {label}
                      </div>
                    </td>
                    {employees.map((emp) => {
                      const assignment = day.assignments.find(
                        (a) => a.employeeId === emp.id
                      )
                      const originalShift = (assignment?.shiftType ??
                        "Off") as ShiftType
                      const shift = getEffectiveShift(
                        day.date,
                        emp.id,
                        originalShift
                      )
                      const cellDimmed =
                        !rowDimmed && isCellDimmed(emp.id, shift)
                      const isEdited =
                        !!editMap && `${day.date}::${emp.id}` in editMap
                      const isSwapSrc =
                        swapSource?.date === day.date &&
                        swapSource?.employeeId === emp.id
                      const sameDay =
                        !!swapSource && swapSource.date === day.date

                      return (
                        <td
                          key={emp.id}
                          className={cn(
                            "border-r px-1 py-1 text-center transition-opacity duration-150",
                            cellDimmed && "opacity-25"
                          )}
                        >
                          {editable ? (
                            <CellDropdown
                              currentShift={shift}
                              isEdited={isEdited}
                              isViolated={hasViolation}
                              isSwapSource={isSwapSrc}
                              swapMode={!!swapSource}
                              sameDay={sameDay}
                              onPickShift={(s) =>
                                onCellEdit!(day.date, emp.id, s)
                              }
                              onStartSwap={() =>
                                setSwapSource({
                                  date: day.date,
                                  employeeId: emp.id,
                                })
                              }
                              onCellClick={() =>
                                handleCellClick(day.date, emp.id)
                              }
                            />
                          ) : (
                            <ScheduleCell shiftType={shift} compact />
                          )}
                        </td>
                      )
                    })}
                    {(() => {
                      const isNormal = !day.isFriday && !day.isSaturday
                      if (!isNormal) {
                        return (
                          <td className="px-1 py-1 text-center text-muted-foreground">
                            —
                          </td>
                        )
                      }
                      const regularsOff = day.assignments.filter((a) => {
                        const emp = empMap.get(a.employeeId)
                        const effectiveShift = getEffectiveShift(
                          day.date,
                          a.employeeId,
                          a.shiftType as ShiftType
                        )
                        return (
                          emp?.role === "regular" &&
                          (effectiveShift === "Off" ||
                            effectiveShift === "Comp Off")
                        )
                      }).length
                      return (
                        <td
                          className={cn(
                            "px-1 py-1 text-center font-medium",
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
        {editable && (
          <span className="flex items-center gap-1.5 rounded px-1.5 py-0.5">
            <span className="size-2 rounded-full bg-blue-400" />
            Edited
          </span>
        )}
      </div>
    </div>
  )
}
