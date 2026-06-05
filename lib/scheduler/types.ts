export type Seniority = "junior" | "mid" | "senior"
export type Role = "team_leader" | "regular"
export type ShiftType = "Morning" | "Night" | "Overnight" | "Off" | "Comp Off"

export interface ScheduleTeam {
  id: string
  name: string
}

export interface ScheduleEmployee {
  id: string
  name: string
  teamId: string
  seniority: Seniority
  role: Role
}

export interface ShiftRequirements {
  normalDay: { overnight: number; night: number }
  // morning = regulars only; on Friday/Saturday the rotating leader is always additional
  friday: { overnight: number; night: number; morning: number }
  saturday: { overnight: number; night: number; morning: number }
}

export const DEFAULT_SHIFT_REQUIREMENTS: ShiftRequirements = {
  normalDay: { overnight: 1, night: 2 },
  friday: { overnight: 1, night: 1, morning: 2 },
  // Leader is extra; 2 regulars in morning on Saturday
  saturday: { overnight: 1, night: 1, morning: 2 },
}

export interface ScheduleParams {
  year: number
  month: number
  employees: ScheduleEmployee[]
  teams: ScheduleTeam[]
  shiftRequirements?: ShiftRequirements
  enforceFixed5DayBlocks?: boolean
}

export interface ShiftAssignment {
  employeeId: string
  shiftType: ShiftType
}

export interface DaySchedule {
  date: string // ISO: "2026-06-01"
  dayOfWeek: number // 0=Sun ... 6=Sat
  isFriday: boolean
  isSaturday: boolean
  isWeekend: boolean
  assignments: ShiftAssignment[]
  violatedConstraints: string[]
}

export interface EmployeeWorkSummary {
  morning: number
  night: number
  overnight: number
  off: number
  compOff: number
  friday: number
  saturday: number
  totalWorked: number
  compensationUnits: number
}

export interface ScheduleSummary {
  totalViolations: number
  violationsByDate: Record<string, string[]>
  employeeStats: Record<string, EmployeeWorkSummary>
}

export interface MonthSchedule {
  id?: string
  year: number
  month: number
  days: DaySchedule[]
  employees: ScheduleEmployee[]
  teams: ScheduleTeam[]
  hasViolations: boolean
  summary: ScheduleSummary
}

// key: `${date}::${employeeId}`, value: overridden shift
export type EditMap = Record<string, ShiftType>

// Internal state used only by the algorithm
export interface EmployeeState {
  consecutiveWorkDays: number
  consecutiveOffDays: number
  lastShift: ShiftType | null
  compOffPending: boolean
  compOffUsedThisWeek: boolean
  workedFridayThisWeek: boolean
  // balance counters (accumulated over the month)
  nightCount: number
  overnightCount: number
  morningCount: number
  fridayCount: number
  saturdayCount: number
  // compensation units earned (primary balance metric)
  compensationUnits: number
}
