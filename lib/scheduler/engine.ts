import type {
  DaySchedule,
  EmployeeState,
  EmployeeWorkSummary,
  MonthSchedule,
  ScheduleEmployee,
  ScheduleParams,
  ScheduleSummary,
  ShiftAssignment,
  ShiftType,
} from "./types"
import { buildMonthDays, getSaturdayLeaderRotation, validateDay } from "./rules"

function initState(employees: ScheduleEmployee[]): Map<string, EmployeeState> {
  return new Map(
    employees.map((e) => [
      e.id,
      {
        consecutiveWorkDays: 0,
        consecutiveOffDays: 0,
        lastShift: null,
        compOffPending: false,
        compOffUsedThisWeek: false,
        workedFridayThisWeek: false,
        nightCount: 0,
        overnightCount: 0,
        morningCount: 0,
        fridayCount: 0,
        saturdayCount: 0,
      },
    ]),
  )
}

function isWorkShift(s: ShiftType): boolean {
  return s === "Morning" || s === "Night" || s === "Overnight"
}

function recordShift(state: EmployeeState, shift: ShiftType, isFriday: boolean, isSaturday: boolean) {
  if (isWorkShift(shift)) {
    state.consecutiveWorkDays++
    state.consecutiveOffDays = 0
    if (shift === "Night") state.nightCount++
    if (shift === "Overnight") state.overnightCount++
    if (shift === "Morning") state.morningCount++
    if (isFriday) state.fridayCount++
    if (isSaturday) state.saturdayCount++
  } else {
    state.consecutiveOffDays++
    state.consecutiveWorkDays = 0
    if (shift === "Comp Off") state.compOffUsedThisWeek = true
  }
  state.lastShift = shift
}

// Sort candidates by preference (lower score = higher priority)
function scoreCandidate(
  state: EmployeeState,
  targetShift: ShiftType,
  balanceKey: keyof Pick<EmployeeState, "nightCount" | "overnightCount" | "morningCount" | "fridayCount" | "saturdayCount">,
): number {
  let score = 0
  // Prefer shift-type consistency
  if (state.lastShift !== null && state.lastShift !== targetShift) score += 100
  // Prefer lower balance count (fairness)
  score += state[balanceKey] * 10
  // Prefer fresher workers
  score += state.consecutiveWorkDays * 2
  return score
}

function pickCandidates(
  pool: ScheduleEmployee[],
  stateMap: Map<string, EmployeeState>,
  targetShift: ShiftType,
  balanceKey: keyof Pick<EmployeeState, "nightCount" | "overnightCount" | "morningCount" | "fridayCount" | "saturdayCount">,
  count: number,
  teamFilter?: string | null, // require this teamId (or null = any)
  excludeTeams?: Set<string>, // exclude employees from these teams
): ScheduleEmployee[] {
  let filtered = pool
  if (teamFilter) {
    filtered = filtered.filter((e) => e.teamId === teamFilter)
  }
  if (excludeTeams && excludeTeams.size > 0) {
    filtered = filtered.filter((e) => !excludeTeams.has(e.teamId))
  }

  filtered.sort((a, b) => {
    const sa = stateMap.get(a.id)!
    const sb = stateMap.get(b.id)!
    return scoreCandidate(sa, targetShift, balanceKey) - scoreCandidate(sb, targetShift, balanceKey)
  })

  return filtered.slice(0, count)
}

export function generateSchedule(params: ScheduleParams): MonthSchedule {
  const { year, month, employees, teams } = params
  const days = buildMonthDays(year, month)
  const satLeaderRotation = getSaturdayLeaderRotation(days, employees)
  const stateMap = initState(employees)
  const scheduleDays: DaySchedule[] = []

  for (const dayInfo of days) {
    const { dateStr, dayOfWeek, isFriday, isSaturday, weekIndex } = dayInfo
    const isNormalDay = !isFriday && !isSaturday

    // Step 1: Reset weekly counters on Sunday
    if (dayOfWeek === 0) {
      for (const state of stateMap.values()) {
        state.compOffPending = false
        state.compOffUsedThisWeek = false
        state.workedFridayThisWeek = false
      }
    }

    const assignments: ShiftAssignment[] = []
    const assigned = new Set<string>()

    // Step 2: Determine forced assignments
    const forcedOff = new Set<string>()
    const forcedCompOff = new Set<string>()
    const forcedWork = new Set<string>() // must work (2 consecutive off days reached)

    for (const emp of employees) {
      const state = stateMap.get(emp.id)!
      if (state.consecutiveWorkDays >= 6) {
        forcedOff.add(emp.id)
      } else if (state.consecutiveOffDays >= 2) {
        forcedWork.add(emp.id)
      }
      // Comp off: force on non-weekend days when pending and not yet used
      // On Thursday (day 4) force it so it's not lost at end of week
      if (
        state.compOffPending &&
        !state.compOffUsedThisWeek &&
        !isFriday &&
        !isSaturday &&
        (dayOfWeek === 4 || (!forcedOff.has(emp.id) && !forcedWork.has(emp.id)))
      ) {
        if (!forcedOff.has(emp.id)) {
          forcedCompOff.add(emp.id)
        }
      }
    }

    // Available pool: not forced-off, not forced-comp-off
    const available = employees.filter(
      (e) => !forcedOff.has(e.id) && !forcedCompOff.has(e.id),
    )

    // Track which teams already have a night/overnight slot today (for team diversity)
    const usedTeamsForNightSlots = new Set<string>()

    // Step 3: Assign Overnight (1 slot every day)
    const overnightPool = available.filter((e) => !assigned.has(e.id))
    let overnightCandidates: ScheduleEmployee[]

    if (isNormalDay) {
      // Prefer team not yet used — try each team in order of overnightCount asc
      const teamsSorted = [...teams].sort((a, b) => {
        const countA = overnightPool
          .filter((e) => e.teamId === a.id)
          .reduce((min, e) => Math.min(min, stateMap.get(e.id)!.overnightCount), Infinity)
        const countB = overnightPool
          .filter((e) => e.teamId === b.id)
          .reduce((min, e) => Math.min(min, stateMap.get(e.id)!.overnightCount), Infinity)
        return countA - countB
      })
      overnightCandidates = pickCandidates(
        overnightPool,
        stateMap,
        "Overnight",
        "overnightCount",
        1,
        teamsSorted[0]?.id,
      )
      if (overnightCandidates.length === 0) {
        // fallback: any available
        overnightCandidates = pickCandidates(overnightPool, stateMap, "Overnight", "overnightCount", 1)
      }
    } else {
      overnightCandidates = pickCandidates(overnightPool, stateMap, "Overnight", "overnightCount", 1)
    }

    for (const emp of overnightCandidates) {
      assignments.push({ employeeId: emp.id, shiftType: "Overnight" })
      assigned.add(emp.id)
      usedTeamsForNightSlots.add(emp.teamId)
    }

    // Step 4: Assign Night shifts
    // Normal: 2 slots; Friday: 1 slot; Saturday: 1 slot
    const nightCount = isNormalDay ? 2 : 1
    const nightPool = available.filter((e) => !assigned.has(e.id))

    for (let i = 0; i < nightCount; i++) {
      let nightCandidates: ScheduleEmployee[]
      if (isNormalDay) {
        nightCandidates = pickCandidates(
          nightPool.filter((e) => !assigned.has(e.id)),
          stateMap,
          "Night",
          "nightCount",
          1,
          null,
          usedTeamsForNightSlots,
        )
        if (nightCandidates.length === 0) {
          nightCandidates = pickCandidates(
            nightPool.filter((e) => !assigned.has(e.id)),
            stateMap,
            "Night",
            "nightCount",
            1,
          )
        }
      } else {
        nightCandidates = pickCandidates(
          nightPool.filter((e) => !assigned.has(e.id)),
          stateMap,
          "Night",
          "nightCount",
          1,
        )
      }
      for (const emp of nightCandidates) {
        assignments.push({ employeeId: emp.id, shiftType: "Night" })
        assigned.add(emp.id)
        usedTeamsForNightSlots.add(emp.teamId)
      }
    }

    // Step 5: Assign Morning shifts
    if (isFriday) {
      // Exactly 2, ≥1 mid/senior
      const morningPool = available.filter((e) => !assigned.has(e.id))
      const seniorPool = morningPool.filter((e) => e.seniority === "mid" || e.seniority === "senior")
      const seniorPick = pickCandidates(seniorPool, stateMap, "Morning", "morningCount", 1)
      for (const emp of seniorPick) {
        assignments.push({ employeeId: emp.id, shiftType: "Morning" })
        assigned.add(emp.id)
      }
      // If no senior was found, pick from general pool
      if (seniorPick.length === 0) {
        const fallback = pickCandidates(
          morningPool.filter((e) => !assigned.has(e.id)),
          stateMap,
          "Morning",
          "morningCount",
          1,
        )
        for (const emp of fallback) {
          assignments.push({ employeeId: emp.id, shiftType: "Morning" })
          assigned.add(emp.id)
        }
      }
      // Second morning slot
      const secondPick = pickCandidates(
        available.filter((e) => !assigned.has(e.id)),
        stateMap,
        "Morning",
        "morningCount",
        1,
      )
      for (const emp of secondPick) {
        assignments.push({ employeeId: emp.id, shiftType: "Morning" })
        assigned.add(emp.id)
      }
    } else if (isSaturday) {
      // Exactly 2: 1 rotating leader + 1 mid/senior
      const morningPool = available.filter((e) => !assigned.has(e.id))
      const rotatingLeaderId = satLeaderRotation.get(weekIndex)

      // Pick the rotating leader first
      const leaderPick = morningPool.filter(
        (e) => e.id === rotatingLeaderId && !assigned.has(e.id),
      )
      for (const emp of leaderPick) {
        assignments.push({ employeeId: emp.id, shiftType: "Morning" })
        assigned.add(emp.id)
      }
      // If leader unavailable, pick any leader
      if (leaderPick.length === 0) {
        const anyLeader = pickCandidates(
          morningPool.filter((e) => e.role === "team_leader" && !assigned.has(e.id)),
          stateMap,
          "Morning",
          "morningCount",
          1,
        )
        for (const emp of anyLeader) {
          assignments.push({ employeeId: emp.id, shiftType: "Morning" })
          assigned.add(emp.id)
        }
      }
      // Second slot: prefer mid/senior
      const remaining = available.filter((e) => !assigned.has(e.id))
      const seniorPick = pickCandidates(
        remaining.filter((e) => e.seniority === "mid" || e.seniority === "senior"),
        stateMap,
        "Morning",
        "morningCount",
        1,
      )
      const secondPick =
        seniorPick.length > 0
          ? seniorPick
          : pickCandidates(remaining, stateMap, "Morning", "morningCount", 1)
      for (const emp of secondPick) {
        assignments.push({ employeeId: emp.id, shiftType: "Morning" })
        assigned.add(emp.id)
      }
    } else {
      // Normal day: assign remaining eligible to Morning
      const morningPool = available.filter((e) => !assigned.has(e.id) && !forcedWork.has(e.id))
      // Workers forced back to work after 2 off days get morning too
      const forcedWorkers = employees.filter(
        (e) => forcedWork.has(e.id) && !forcedOff.has(e.id) && !forcedCompOff.has(e.id) && !assigned.has(e.id),
      )
      for (const emp of [...forcedWorkers, ...morningPool]) {
        if (!assigned.has(emp.id)) {
          assignments.push({ employeeId: emp.id, shiftType: "Morning" })
          assigned.add(emp.id)
        }
      }
    }

    // Step 6: Assign Off / Comp Off to everyone not yet assigned
    for (const emp of employees) {
      if (assigned.has(emp.id)) continue
      const state = stateMap.get(emp.id)!
      let shift: ShiftType

      if (forcedOff.has(emp.id)) {
        shift = "Off"
      } else if (forcedCompOff.has(emp.id)) {
        shift = "Comp Off"
      } else if (state.compOffPending && !state.compOffUsedThisWeek && !isFriday && !isSaturday) {
        shift = "Comp Off"
      } else {
        shift = "Off"
      }
      assignments.push({ employeeId: emp.id, shiftType: shift })
      assigned.add(emp.id)
    }

    // Step 7: Update state for all employees
    for (const emp of employees) {
      const assignment = assignments.find((a) => a.employeeId === emp.id)
      const shift = assignment?.shiftType ?? "Off"
      const state = stateMap.get(emp.id)!
      recordShift(state, shift, isFriday, isSaturday)
    }

    // Step 8: Mark Friday workers for comp-off
    if (isFriday) {
      for (const emp of employees) {
        const assignment = assignments.find((a) => a.employeeId === emp.id)
        if (assignment && isWorkShift(assignment.shiftType)) {
          stateMap.get(emp.id)!.compOffPending = true
          stateMap.get(emp.id)!.workedFridayThisWeek = true
        }
      }
    }

    // Step 9: Validate and record day
    const daySchedule: DaySchedule = {
      date: dateStr,
      dayOfWeek,
      isFriday,
      isSaturday,
      isWeekend: isFriday || isSaturday,
      assignments,
      violatedConstraints: [],
    }
    daySchedule.violatedConstraints = validateDay(daySchedule, employees, teams)
    scheduleDays.push(daySchedule)
  }

  // Build summary
  const violationsByDate: Record<string, string[]> = {}
  let totalViolations = 0

  for (const day of scheduleDays) {
    if (day.violatedConstraints.length > 0) {
      violationsByDate[day.date] = day.violatedConstraints
      totalViolations += day.violatedConstraints.length
    }
  }

  const employeeStats: Record<string, EmployeeWorkSummary> = {}
  for (const emp of employees) {
    const s = stateMap.get(emp.id)!
    employeeStats[emp.id] = {
      morning: s.morningCount,
      night: s.nightCount,
      overnight: s.overnightCount,
      off: scheduleDays.filter(
        (d) => d.assignments.find((a) => a.employeeId === emp.id)?.shiftType === "Off",
      ).length,
      compOff: scheduleDays.filter(
        (d) => d.assignments.find((a) => a.employeeId === emp.id)?.shiftType === "Comp Off",
      ).length,
      friday: s.fridayCount,
      saturday: s.saturdayCount,
      totalWorked: s.morningCount + s.nightCount + s.overnightCount,
    }
  }

  const summary: ScheduleSummary = { totalViolations, violationsByDate, employeeStats }

  return {
    year,
    month,
    days: scheduleDays,
    employees,
    teams,
    hasViolations: totalViolations > 0,
    summary,
  }
}
