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

export interface ScheduleParams {
  year: number
  month: number
  employees: ScheduleEmployee[]
  teams: ScheduleTeam[]
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
}
