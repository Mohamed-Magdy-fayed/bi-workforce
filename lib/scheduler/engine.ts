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
import { DEFAULT_SHIFT_REQUIREMENTS } from "./types"
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
// Compensation fairness is the sole driver.
function scoreRegular(state: EmployeeState): number {
  return state.compensationUnits * 20 + state.consecutiveWorkDays * 1
}

export function generateSchedule(params: ScheduleParams): MonthSchedule {
  const { year, month, employees, teams } = params
  const req = params.shiftRequirements ?? DEFAULT_SHIFT_REQUIREMENTS

  const leaders = employees.filter((e) => e.role === "team_leader")
  const regulars = employees.filter((e) => e.role === "regular")

  const days = buildMonthDays(year, month)
  const satLeaderRotation = getSaturdayLeaderRotation(days, leaders)
  const stateMap = initState(employees)
  const scheduleDays: DaySchedule[] = []

  // Tracks how many times each team "doubled" (one member in night/overnight,
  // the other taking the off slot). Used to rotate the off slot fairly.
  const teamDoubleCount = new Map<string, number>(teams.map((t) => [t.id, 0]))

  for (const dayInfo of days) {
    const { dateStr, dayOfWeek, isFriday, isSaturday, weekIndex } = dayInfo
    const isNormalDay = !isFriday && !isSaturday

    // Reset weekly flags on Sunday. Do NOT reset compOffPending — comp-offs earned
    // on Friday persist across weeks until used.
    if (dayOfWeek === 0) {
      for (const state of stateMap.values()) {
        state.compOffUsedThisWeek = false
        state.workedFridayThisWeek = false
      }
    }

    const assignments: ShiftAssignment[] = []
    const assigned = new Set<string>()

    // ── STEP 1: Identify forced-off regulars (6 consecutive days) ────────────
    const forcedOffRegulars = new Set<string>()
    for (const emp of regulars) {
      const state = stateMap.get(emp.id)!
      if (state.consecutiveWorkDays >= 6) {
        forcedOffRegulars.add(emp.id)
      }
    }

    // ── STEP 2: Assign leaders ───────────────────────────────────────────────
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
        assignments.push({
          employeeId: leader.id,
          shiftType: isRotating ? "Morning" : "Off",
        })
        assigned.add(leader.id)
      }
    }

    // ── STEP 3: Pool of non-forced regulars for shift assignment ─────────────
    // Comp-off selection is deferred to AFTER night/overnight are filled,
    // so the full non-forced pool is available for the best shift picks.
    const shiftPool = regulars.filter((e) => !forcedOffRegulars.has(e.id))

    // Track which teams are committed to night/overnight (diversity constraint)
    const usedTeamsForNightSlots = new Set<string>()

    // ── STEP 4: Assign Overnight ─────────────────────────────────────────────
    const overnightCount = isFriday
      ? req.friday.overnight
      : isSaturday
        ? req.saturday.overnight
        : req.normalDay.overnight

    for (let i = 0; i < overnightCount; i++) {
      const unassigned = shiftPool.filter((e) => !assigned.has(e.id))

      // Hard constraint: never assign Overnight to someone who worked Night yesterday.
      // Night ends midnight; Overnight starts 3am — only 3h gap, physically unsafe.
      const safePool = unassigned.filter(
        (e) => stateMap.get(e.id)!.lastShift !== "Night"
      )
      // Fallback: if everyone worked night yesterday (edge case), use full pool.
      const candidatePool = safePool.length > 0 ? safePool : unassigned

      // On normal days, enforce team diversity: pick from teams not yet in night/overnight.
      // Sort globally by compensation (lowest first) then pick first diversity-eligible.
      let pick: ScheduleEmployee | undefined
      if (isNormalDay && usedTeamsForNightSlots.size < teams.length) {
        const sorted = [...candidatePool]
          .filter((e) => !usedTeamsForNightSlots.has(e.teamId))
          .sort(
            (a, b) =>
              scoreRegular(stateMap.get(a.id)!) -
              scoreRegular(stateMap.get(b.id)!)
          )
        pick = sorted[0]
      }
      // Fallback (no diversity constraint or couldn't satisfy it)
      if (!pick) {
        const sorted = [...candidatePool].sort(
          (a, b) =>
            scoreRegular(stateMap.get(a.id)!) -
            scoreRegular(stateMap.get(b.id)!)
        )
        pick = sorted[0]
      }

      if (pick) {
        assignments.push({ employeeId: pick.id, shiftType: "Overnight" })
        assigned.add(pick.id)
        usedTeamsForNightSlots.add(pick.teamId)
      }
    }

    // ── STEP 5: Assign Night shifts ──────────────────────────────────────────
    const nightCount = isFriday
      ? req.friday.night
      : isSaturday
        ? req.saturday.night
        : req.normalDay.night

    for (let i = 0; i < nightCount; i++) {
      const unassigned = shiftPool.filter((e) => !assigned.has(e.id))

      let pick: ScheduleEmployee | undefined
      if (isNormalDay && usedTeamsForNightSlots.size < teams.length) {
        // Enforce team diversity: pick from teams not yet used for night/overnight.
        const sorted = [...unassigned]
          .filter((e) => !usedTeamsForNightSlots.has(e.teamId))
          .sort(
            (a, b) =>
              scoreRegular(stateMap.get(a.id)!) -
              scoreRegular(stateMap.get(b.id)!)
          )
        pick = sorted[0]
      }
      if (!pick) {
        const sorted = [...unassigned].sort(
          (a, b) =>
            scoreRegular(stateMap.get(a.id)!) -
            scoreRegular(stateMap.get(b.id)!)
        )
        pick = sorted[0]
      }

      if (pick) {
        assignments.push({ employeeId: pick.id, shiftType: "Night" })
        assigned.add(pick.id)
        usedTeamsForNightSlots.add(pick.teamId)
      }
    }

    // ── STEP 6: Select comp-off from morning candidates ──────────────────────
    // Comp-offs are decided AFTER night/overnight, so they never pull the best
    // candidates away from the high-compensation slots.
    const forcedCompOffRegulars = new Set<string>()

    if (isNormalDay && forcedOffRegulars.size === 0) {
      // Morning-bound regulars: non-forced, not yet assigned to night/overnight
      const morningCandidates = shiftPool.filter((e) => !assigned.has(e.id))

      const compOffEligible = morningCandidates
        .filter(
          (e) =>
            stateMap.get(e.id)!.compOffPending &&
            !stateMap.get(e.id)!.compOffUsedThisWeek
        )
        .sort((a, b) => {
          // Primary: team with lowest double count gets the off slot (rotation)
          const dA = teamDoubleCount.get(a.teamId) ?? 0
          const dB = teamDoubleCount.get(b.teamId) ?? 0
          if (dA !== dB) return dA - dB
          // Secondary: highest compensation earns rest first
          return (
            stateMap.get(b.id)!.compensationUnits -
            stateMap.get(a.id)!.compensationUnits
          )
        })

      if (compOffEligible.length > 0) {
        forcedCompOffRegulars.add(compOffEligible[0].id)
      }
    }

    // ── STEP 7: Assign Morning to remaining non-forced regulars ──────────────
    if (isFriday) {
      // req.friday.morning regulars, ≥1 must be mid/senior.
      // Leaders are always off on Friday — not counted in morning requirement.
      const morningTarget = req.friday.morning
      let morningFilled = 0

      // First pick: prefer mid/senior (ensures seniority requirement)
      {
        const pool = shiftPool.filter((e) => !assigned.has(e.id))
        const seniors = pool.filter(
          (e) => e.seniority === "mid" || e.seniority === "senior"
        )
        const pick = (seniors.length > 0 ? seniors : pool).sort(
          (a, b) =>
            scoreRegular(stateMap.get(a.id)!) -
            scoreRegular(stateMap.get(b.id)!)
        )[0]
        if (pick) {
          assignments.push({ employeeId: pick.id, shiftType: "Morning" })
          assigned.add(pick.id)
          morningFilled++
        }
      }

      // Remaining picks: any available regular
      while (morningFilled < morningTarget) {
        const pool = shiftPool.filter((e) => !assigned.has(e.id))
        if (pool.length === 0) break
        const pick = [...pool].sort(
          (a, b) =>
            scoreRegular(stateMap.get(a.id)!) -
            scoreRegular(stateMap.get(b.id)!)
        )[0]
        assignments.push({ employeeId: pick.id, shiftType: "Morning" })
        assigned.add(pick.id)
        morningFilled++
      }
    } else if (isSaturday) {
      // req.saturday.morning regulars + 1 rotating leader (already assigned in Step 2).
      // Leader is NOT counted in the morning requirement — treat as extra coverage.
      const morningTarget = req.saturday.morning
      let morningFilled = 0

      // First pick: prefer mid/senior regular
      {
        const pool = shiftPool.filter((e) => !assigned.has(e.id))
        const seniors = pool.filter(
          (e) => e.seniority === "mid" || e.seniority === "senior"
        )
        const pick = (seniors.length > 0 ? seniors : pool).sort(
          (a, b) =>
            scoreRegular(stateMap.get(a.id)!) -
            scoreRegular(stateMap.get(b.id)!)
        )[0]
        if (pick) {
          assignments.push({ employeeId: pick.id, shiftType: "Morning" })
          assigned.add(pick.id)
          morningFilled++
        }
      }

      // Remaining picks
      while (morningFilled < morningTarget) {
        const pool = shiftPool.filter((e) => !assigned.has(e.id))
        if (pool.length === 0) break
        const pick = [...pool].sort(
          (a, b) =>
            scoreRegular(stateMap.get(a.id)!) -
            scoreRegular(stateMap.get(b.id)!)
        )[0]
        assignments.push({ employeeId: pick.id, shiftType: "Morning" })
        assigned.add(pick.id)
        morningFilled++
      }
    } else {
      // Normal day: remaining non-forced, non-comp-off regulars → Morning
      for (const emp of regulars) {
        if (assigned.has(emp.id)) continue
        if (forcedOffRegulars.has(emp.id) || forcedCompOffRegulars.has(emp.id))
          continue
        assignments.push({ employeeId: emp.id, shiftType: "Morning" })
        assigned.add(emp.id)
      }
    }

    // ── STEP 8: Assign Off / Comp Off to all unassigned ──────────────────────
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

    // ── STEP 8b: Track team doubling for comp-off rotation ───────────────────
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

    // ── STEP 9: Update state for all employees ───────────────────────────────
    for (const emp of employees) {
      const assignment = assignments.find((a) => a.employeeId === emp.id)
      const shift = assignment?.shiftType ?? "Off"
      recordShift(stateMap.get(emp.id)!, shift, isFriday, isSaturday)
    }

    // ── STEP 10: Mark regulars who worked Friday for comp-off ────────────────
    if (isFriday) {
      for (const emp of regulars) {
        const assignment = assignments.find((a) => a.employeeId === emp.id)
        if (assignment && isWorkShift(assignment.shiftType)) {
          stateMap.get(emp.id)!.compOffPending = true
          stateMap.get(emp.id)!.workedFridayThisWeek = true
        }
      }
    }

    // ── STEP 11: Validate and record ─────────────────────────────────────────
    const daySchedule: DaySchedule = {
      date: dateStr,
      dayOfWeek,
      isFriday,
      isSaturday,
      isWeekend: isFriday || isSaturday,
      assignments,
      violatedConstraints: [],
    }
    daySchedule.violatedConstraints = validateDay(
      daySchedule,
      employees,
      teams,
      req
    )
    scheduleDays.push(daySchedule)
  }

  // ── Build summary ─────────────────────────────────────────────────────────
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
