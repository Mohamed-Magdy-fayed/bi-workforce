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
        compensationUnits: 0,
      },
    ])
  )
}

function isWorkShift(s: ShiftType): boolean {
  return s === "Morning" || s === "Night" || s === "Overnight"
}

function getCompensationUnits(
  shift: ShiftType,
  isFriday: boolean,
  isSaturday: boolean
): number {
  if (!isWorkShift(shift)) return 0
  if (isFriday) return 1.75
  if (isSaturday) return shift === "Overnight" ? 2.0 : 1.5
  if (shift === "Overnight") return 0.5
  if (shift === "Night") return 0.25
  return 0 // normal Morning
}

function recordShift(
  state: EmployeeState,
  shift: ShiftType,
  isFriday: boolean,
  isSaturday: boolean
) {
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
  state.compensationUnits += getCompensationUnits(shift, isFriday, isSaturday)
  state.lastShift = shift
}

// Lower score = higher priority for assignment.
// Compensation fairness is the sole driver — no consistency bonus, which would
// let incumbents keep winning their shift type regardless of accumulated pay.
function scoreRegular(state: EmployeeState): number {
  return state.compensationUnits * 20 + state.consecutiveWorkDays * 1
}

function pickCandidates(
  pool: ScheduleEmployee[],
  stateMap: Map<string, EmployeeState>,
  targetShift: ShiftType,
  count: number,
  excludeTeams?: Set<string>
): ScheduleEmployee[] {
  let filtered = pool
  if (excludeTeams && excludeTeams.size > 0) {
    filtered = filtered.filter((e) => !excludeTeams.has(e.teamId))
  }
  filtered = [...filtered].sort(
    (a, b) =>
      scoreRegular(stateMap.get(a.id)!) - scoreRegular(stateMap.get(b.id)!)
  )
  return filtered.slice(0, count)
}

export function generateSchedule(params: ScheduleParams): MonthSchedule {
  const { year, month, employees, teams } = params

  const leaders = employees.filter((e) => e.role === "team_leader")
  const regulars = employees.filter((e) => e.role === "regular")

  const days = buildMonthDays(year, month)
  const satLeaderRotation = getSaturdayLeaderRotation(days, leaders)
  const stateMap = initState(employees)
  const scheduleDays: DaySchedule[] = []

  // Tracks how many times each team "doubled" — had one member in night/overnight
  // while the team's other regular took the off slot. Used to rotate fairly.
  const teamDoubleCount = new Map<string, number>(teams.map((t) => [t.id, 0]))

  for (const dayInfo of days) {
    const { dateStr, dayOfWeek, isFriday, isSaturday, weekIndex } = dayInfo
    const isNormalDay = !isFriday && !isSaturday

    // Reset weekly flags on Sunday — but NOT compOffPending, so Friday comp-offs
    // earned last week persist until actually used (not silently dropped).
    if (dayOfWeek === 0) {
      for (const state of stateMap.values()) {
        state.compOffUsedThisWeek = false
        state.workedFridayThisWeek = false
      }
    }

    const assignments: ShiftAssignment[] = []
    const assigned = new Set<string>()

    // ── STEP 1: Forced-off / forced-comp-off for regulars ───────────────────
    const forcedOffRegulars = new Set<string>()
    const forcedCompOffRegulars = new Set<string>()
    const forcedBackToWork = new Set<string>()

    for (const emp of regulars) {
      const state = stateMap.get(emp.id)!
      if (state.consecutiveWorkDays >= 6) {
        forcedOffRegulars.add(emp.id)
      } else if (state.consecutiveOffDays >= 2) {
        forcedBackToWork.add(emp.id)
      }
    }

    // Hard cap: at most 1 regular off per normal day total.
    // If someone is already forced-off (6 consecutive days), no comp-off that day.
    // Comp-offs no longer expire on Sunday, so there's no need to drain on Thursday.
    // Among eligible candidates, prefer the team that has "doubled" least (rotation).
    if (isNormalDay && forcedOffRegulars.size === 0) {
      const compOffEligible = regulars
        .filter(
          (e) =>
            stateMap.get(e.id)!.compOffPending &&
            !stateMap.get(e.id)!.compOffUsedThisWeek &&
            !forcedOffRegulars.has(e.id)
        )
        .sort((a, b) => {
          // Primary: team with lowest double count gets the off slot (rotation)
          const dA = teamDoubleCount.get(a.teamId) ?? 0
          const dB = teamDoubleCount.get(b.teamId) ?? 0
          if (dA !== dB) return dA - dB
          // Secondary: highest compensation gets the rest (fairness tiebreaker)
          return (
            stateMap.get(b.id)!.compensationUnits -
            stateMap.get(a.id)!.compensationUnits
          )
        })

      if (compOffEligible.length > 0) {
        forcedCompOffRegulars.add(compOffEligible[0].id)
      }
    }

    // ── STEP 2: Assign leaders (fixed-schedule, no Night/Overnight ever) ────
    if (isNormalDay) {
      for (const leader of leaders) {
        const state = stateMap.get(leader.id)!
        const shift: ShiftType =
          state.consecutiveWorkDays >= 6 ? "Off" : "Morning"
        assignments.push({ employeeId: leader.id, shiftType: shift })
        assigned.add(leader.id)
      }
    } else if (isFriday) {
      for (const leader of leaders) {
        assignments.push({ employeeId: leader.id, shiftType: "Off" })
        assigned.add(leader.id)
      }
    } else {
      // Saturday: rotating leader → Morning, rest → Off
      const rotatingLeaderId = satLeaderRotation.get(weekIndex)
      for (const leader of leaders) {
        const isRotating =
          leader.id === rotatingLeaderId &&
          stateMap.get(leader.id)!.consecutiveWorkDays < 6
        const shift: ShiftType = isRotating ? "Morning" : "Off"
        assignments.push({ employeeId: leader.id, shiftType: shift })
        assigned.add(leader.id)
      }
    }

    // ── STEP 3: Pool of available regulars for this day ─────────────────────
    const availableRegulars = regulars.filter(
      (e) => !forcedOffRegulars.has(e.id) && !forcedCompOffRegulars.has(e.id)
    )

    // Track which teams have been used for night/overnight slots (team diversity)
    const usedTeamsForNightSlots = new Set<string>()

    // ── STEP 4: Assign Overnight (1 slot every day, regulars only) ───────────
    {
      const pool = availableRegulars.filter((e) => !assigned.has(e.id))

      let pick: ScheduleEmployee[]
      if (isNormalDay) {
        // Pick the team whose available member has the lowest compensation (fairest choice),
        // enforcing that no two night/overnight slots share the same team.
        const teamsSortedByComp = [...teams].sort((a, b) => {
          const minA = Math.min(
            ...pool
              .filter((e) => e.teamId === a.id)
              .map((e) => stateMap.get(e.id)!.compensationUnits),
            Infinity
          )
          const minB = Math.min(
            ...pool
              .filter((e) => e.teamId === b.id)
              .map((e) => stateMap.get(e.id)!.compensationUnits),
            Infinity
          )
          return minA - minB
        })
        const preferredTeam = teamsSortedByComp[0]?.id
        pick = pickCandidates(
          pool.filter((e) => e.teamId === preferredTeam),
          stateMap,
          "Overnight",
          1
        )
        if (pick.length === 0) {
          pick = pickCandidates(pool, stateMap, "Overnight", 1)
        }
      } else {
        pick = pickCandidates(pool, stateMap, "Overnight", 1)
      }

      for (const emp of pick) {
        assignments.push({ employeeId: emp.id, shiftType: "Overnight" })
        assigned.add(emp.id)
        usedTeamsForNightSlots.add(emp.teamId)
      }
    }

    // ── STEP 5: Assign Night shifts (regulars only) ──────────────────────────
    // Normal: 2 slots | Friday: 1 slot | Saturday: 1 slot
    const nightSlotCount = isNormalDay ? 2 : 1

    for (let i = 0; i < nightSlotCount; i++) {
      const pool = availableRegulars.filter((e) => !assigned.has(e.id))
      let pick: ScheduleEmployee[]

      if (isNormalDay) {
        // Require a different team from those already in overnight/night (team diversity)
        pick = pickCandidates(
          pool,
          stateMap,
          "Night",
          1,
          usedTeamsForNightSlots
        )
        if (pick.length === 0) {
          pick = pickCandidates(pool, stateMap, "Night", 1)
        }
      } else {
        pick = pickCandidates(pool, stateMap, "Night", 1)
      }

      for (const emp of pick) {
        assignments.push({ employeeId: emp.id, shiftType: "Night" })
        assigned.add(emp.id)
        usedTeamsForNightSlots.add(emp.teamId)
      }
    }

    // ── STEP 6: Assign Morning slots (regulars only) ─────────────────────────
    if (isFriday) {
      // Exactly 2 morning from regulars, ≥1 mid/senior
      const pool = availableRegulars.filter((e) => !assigned.has(e.id))
      const seniors = pool.filter(
        (e) => e.seniority === "mid" || e.seniority === "senior"
      )

      const firstSeniorPick = pickCandidates(seniors, stateMap, "Morning", 1)
      const firstPick =
        firstSeniorPick.length > 0
          ? firstSeniorPick
          : pickCandidates(pool, stateMap, "Morning", 1)

      for (const emp of firstPick) {
        assignments.push({ employeeId: emp.id, shiftType: "Morning" })
        assigned.add(emp.id)
      }
      const secondPick = pickCandidates(
        availableRegulars.filter((e) => !assigned.has(e.id)),
        stateMap,
        "Morning",
        1
      )
      for (const emp of secondPick) {
        assignments.push({ employeeId: emp.id, shiftType: "Morning" })
        assigned.add(emp.id)
      }
    } else if (isSaturday) {
      // 1 additional regular morning (rotating leader already assigned in Step 2)
      const pool = availableRegulars.filter((e) => !assigned.has(e.id))
      const seniors = pool.filter(
        (e) => e.seniority === "mid" || e.seniority === "senior"
      )
      const pick =
        seniors.length > 0
          ? pickCandidates(seniors, stateMap, "Morning", 1)
          : pickCandidates(pool, stateMap, "Morning", 1)

      for (const emp of pick) {
        assignments.push({ employeeId: emp.id, shiftType: "Morning" })
        assigned.add(emp.id)
      }
    } else {
      // Normal day: remaining available regulars → Morning
      for (const emp of regulars) {
        if (assigned.has(emp.id)) continue
        if (forcedOffRegulars.has(emp.id) || forcedCompOffRegulars.has(emp.id))
          continue
        assignments.push({ employeeId: emp.id, shiftType: "Morning" })
        assigned.add(emp.id)
      }
    }

    // ── STEP 7: Assign Off / Comp Off to all unassigned ─────────────────────
    for (const emp of employees) {
      if (assigned.has(emp.id)) continue
      const state = stateMap.get(emp.id)!
      let shift: ShiftType

      if (forcedOffRegulars.has(emp.id)) {
        shift = "Off"
      } else if (forcedCompOffRegulars.has(emp.id)) {
        shift = "Comp Off"
      } else if (
        state.compOffPending &&
        !state.compOffUsedThisWeek &&
        !isFriday &&
        !isSaturday
      ) {
        shift = "Comp Off"
      } else {
        shift = "Off"
      }

      assignments.push({ employeeId: emp.id, shiftType: shift })
      assigned.add(emp.id)
    }

    // ── STEP 7b: Track team doubling for rotation ────────────────────────────
    if (isNormalDay) {
      for (const team of teams) {
        const members = regulars.filter((e) => e.teamId === team.id)
        const hasNightSlot = members.some((e) => {
          const s = assignments.find((a) => a.employeeId === e.id)?.shiftType
          return s === "Night" || s === "Overnight"
        })
        const hasOff = members.some((e) => {
          const s = assignments.find((a) => a.employeeId === e.id)?.shiftType
          return s === "Off" || s === "Comp Off"
        })
        if (hasNightSlot && hasOff) {
          teamDoubleCount.set(team.id, (teamDoubleCount.get(team.id) ?? 0) + 1)
        }
      }
    }

    // ── STEP 8: Update state for all employees ───────────────────────────────
    for (const emp of employees) {
      const assignment = assignments.find((a) => a.employeeId === emp.id)
      const shift = assignment?.shiftType ?? "Off"
      recordShift(stateMap.get(emp.id)!, shift, isFriday, isSaturday)
    }

    // ── STEP 9: Mark regulars who worked Friday for comp-off ────────────────
    if (isFriday) {
      for (const emp of regulars) {
        const assignment = assignments.find((a) => a.employeeId === emp.id)
        if (assignment && isWorkShift(assignment.shiftType)) {
          stateMap.get(emp.id)!.compOffPending = true
          stateMap.get(emp.id)!.workedFridayThisWeek = true
        }
      }
    }

    // ── STEP 10: Validate and record ────────────────────────────────────────
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

  // ── Build summary ────────────────────────────────────────────────────────
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
        (d) =>
          d.assignments.find((a) => a.employeeId === emp.id)?.shiftType ===
          "Off"
      ).length,
      compOff: scheduleDays.filter(
        (d) =>
          d.assignments.find((a) => a.employeeId === emp.id)?.shiftType ===
          "Comp Off"
      ).length,
      friday: s.fridayCount,
      saturday: s.saturdayCount,
      totalWorked: s.morningCount + s.nightCount + s.overnightCount,
      compensationUnits: s.compensationUnits,
    }
  }

  const summary: ScheduleSummary = {
    totalViolations,
    violationsByDate,
    employeeStats,
  }

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
