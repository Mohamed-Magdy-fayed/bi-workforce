import type { DaySchedule, ScheduleEmployee, ScheduleTeam, ShiftType } from "./types"

export type DayType = "normal" | "friday" | "saturday"

export interface DayInfo {
  date: Date
  dateStr: string // "YYYY-MM-DD"
  dayOfWeek: number
  type: DayType
  isFriday: boolean
  isSaturday: boolean
  isWeekend: boolean
  weekIndex: number // 0-based week index within month (Sun–Sat)
}

export function buildMonthDays(year: number, month: number): DayInfo[] {
  const days: DayInfo[] = []
  const daysInMonth = new Date(year, month, 0).getDate()
  let weekIndex = 0
  let prevDow = -1

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d)
    const dow = date.getDay() // 0=Sun
    // new week starts on Sunday
    if (dow < prevDow) weekIndex++
    prevDow = dow

    const isFriday = dow === 5
    const isSaturday = dow === 6
    const type: DayType = isFriday ? "friday" : isSaturday ? "saturday" : "normal"

    const mm = String(month).padStart(2, "0")
    const dd = String(d).padStart(2, "0")

    days.push({
      date,
      dateStr: `${year}-${mm}-${dd}`,
      dayOfWeek: dow,
      type,
      isFriday,
      isSaturday,
      isWeekend: isFriday || isSaturday,
      weekIndex,
    })
  }
  return days
}

export function getSaturdayLeaderRotation(
  days: DayInfo[],
  employees: ScheduleEmployee[],
): Map<number, string> {
  const leaders = employees.filter((e) => e.role === "team_leader")
  if (leaders.length === 0) return new Map()

  const saturdays = days.filter((d) => d.isSaturday)
  const rotation = new Map<number, string>()
  saturdays.forEach((day, idx) => {
    rotation.set(day.weekIndex, leaders[idx % leaders.length].id)
  })
  return rotation
}

export function validateDay(
  day: DaySchedule,
  employees: ScheduleEmployee[],
  teams: ScheduleTeam[],
): string[] {
  const violations: string[] = []
  const assignmentMap = new Map(day.assignments.map((a) => [a.employeeId, a.shiftType]))
  const empMap = new Map(employees.map((e) => [e.id, e]))

  const byShift = (shift: ShiftType) =>
    day.assignments
      .filter((a) => a.shiftType === shift)
      .map((a) => empMap.get(a.employeeId))
      .filter(Boolean) as ScheduleEmployee[]

  const overnight = byShift("Overnight")
  const night = byShift("Night")
  const morning = byShift("Morning")

  // Overnight: exactly 1 every day
  if (overnight.length !== 1) {
    violations.push(`Overnight count must be 1 (got ${overnight.length})`)
  }

  if (day.dayOfWeek >= 0 && !day.isFriday && !day.isSaturday) {
    // Normal day (Sun–Thu)
    if (night.length !== 2) {
      violations.push(`Night count must be 2 on workdays (got ${night.length})`)
    }
    // Team diversity: all 3 slots from different teams
    const slots = [...overnight, ...night]
    const usedTeams = new Set(slots.map((e) => e.teamId))
    if (usedTeams.size < Math.min(3, teams.length) && slots.length >= 3) {
      violations.push(`Overnight+Night slots must cover all teams (only ${usedTeams.size} team(s))`)
    }
  }

  if (day.isFriday) {
    if (night.length !== 1) {
      violations.push(`Night count must be 1 on Friday (got ${night.length})`)
    }
    if (morning.length !== 2) {
      violations.push(`Morning count must be 2 on Friday (got ${morning.length})`)
    }
    const hasSenior = morning.some((e) => e.seniority === "mid" || e.seniority === "senior")
    if (morning.length > 0 && !hasSenior) {
      violations.push("Friday morning must include at least 1 mid/senior employee")
    }
  }

  if (day.isSaturday) {
    if (night.length !== 1) {
      violations.push(`Night count must be 1 on Saturday (got ${night.length})`)
    }
    if (morning.length !== 2) {
      violations.push(`Morning count must be 2 on Saturday (got ${morning.length})`)
    }
    const hasSenior = morning.some((e) => e.seniority === "mid" || e.seniority === "senior")
    if (morning.length > 0 && !hasSenior) {
      violations.push("Saturday morning must include at least 1 mid/senior employee")
    }
    const hasLeader = morning.some((e) => e.role === "team_leader")
    if (morning.length > 0 && !hasLeader) {
      violations.push("Saturday morning must include the rotating team leader")
    }
  }

  // Suppress unused warning
  void assignmentMap

  return violations
}
