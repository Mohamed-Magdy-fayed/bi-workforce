import type {
  DaySchedule,
  ScheduleEmployee,
  ScheduleTeam,
  ShiftType,
} from "./types"

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
    const type: DayType = isFriday
      ? "friday"
      : isSaturday
        ? "saturday"
        : "normal"

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
  employees: ScheduleEmployee[]
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
  teams: ScheduleTeam[]
): string[] {
  const violations: string[] = []
  const assignmentMap = new Map(
    day.assignments.map((a) => [a.employeeId, a.shiftType])
  )
  const empMap = new Map(employees.map((e) => [e.id, e]))

  const byShift = (shift: ShiftType) =>
    day.assignments
      .filter((a) => a.shiftType === shift)
      .map((a) => empMap.get(a.employeeId))
      .filter(Boolean) as ScheduleEmployee[]

  const overnight = byShift("Overnight")
  const night = byShift("Night")
  const morning = byShift("Morning")

  // Leaders must never appear in Night or Overnight shifts
  const leadersInNight = night.filter((e) => e.role === "team_leader")
  if (leadersInNight.length > 0) {
    violations.push(
      `Team leader(s) incorrectly assigned to Night: ${leadersInNight.map((e) => e.name).join(", ")}`
    )
  }
  const leadersInOvernight = overnight.filter((e) => e.role === "team_leader")
  if (leadersInOvernight.length > 0) {
    violations.push(
      `Team leader(s) incorrectly assigned to Overnight: ${leadersInOvernight.map((e) => e.name).join(", ")}`
    )
  }

  // Overnight: exactly 1 every day
  if (overnight.length !== 1) {
    violations.push(`Overnight count must be 1 (got ${overnight.length})`)
  }

  if (!day.isFriday && !day.isSaturday) {
    // Normal day (Sun–Thu)
    if (night.length !== 2) {
      violations.push(`Night count must be 2 on workdays (got ${night.length})`)
    }
    // Team diversity: overnight + 2 night must each be from a different team
    const slots = [...overnight, ...night]
    const usedTeams = new Set(slots.map((e) => e.teamId))
    if (usedTeams.size < Math.min(3, teams.length) && slots.length >= 3) {
      violations.push(
        `Overnight+Night slots must cover all teams (only ${usedTeams.size} team(s))`
      )
    }
  }

  if (day.isFriday) {
    if (night.length !== 1) {
      violations.push(`Night count must be 1 on Friday (got ${night.length})`)
    }
    // Friday morning = regulars only (leaders are off)
    const regularMorning = morning.filter((e) => e.role === "regular")
    if (regularMorning.length !== 2) {
      violations.push(
        `Friday morning must have 2 regular members (got ${regularMorning.length})`
      )
    }
    const hasSenior = regularMorning.some(
      (e) => e.seniority === "mid" || e.seniority === "senior"
    )
    if (regularMorning.length > 0 && !hasSenior) {
      violations.push(
        "Friday morning must include at least 1 mid/senior regular"
      )
    }
  }

  if (day.isSaturday) {
    if (night.length !== 1) {
      violations.push(`Night count must be 1 on Saturday (got ${night.length})`)
    }
    // Saturday morning = 1 rotating leader + 1 regular = 2 total
    const leaderMorning = morning.filter((e) => e.role === "team_leader")
    const regularMorning = morning.filter((e) => e.role === "regular")
    if (leaderMorning.length !== 1) {
      violations.push(
        `Saturday morning must include exactly 1 team leader (got ${leaderMorning.length})`
      )
    }
    if (regularMorning.length !== 1) {
      violations.push(
        `Saturday morning must include exactly 1 regular member (got ${regularMorning.length})`
      )
    }
    const hasSenior = regularMorning.some(
      (e) => e.seniority === "mid" || e.seniority === "senior"
    )
    if (regularMorning.length > 0 && !hasSenior) {
      violations.push("Saturday morning regular must be mid/senior level")
    }
  }

  // Suppress unused warning
  void assignmentMap

  return violations
}
