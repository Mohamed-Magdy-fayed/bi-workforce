import { boolean, date, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core"

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
})

export const employees = pgTable("employees", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
  seniority: text("seniority").notNull(), // 'junior' | 'mid' | 'senior'
  role: text("role").notNull(), // 'team_leader' | 'regular'
  createdAt: timestamp("created_at").defaultNow(),
})

export const schedules = pgTable(
  "schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    hasViolations: boolean("has_violations").notNull().default(false),
    generatedAt: timestamp("generated_at").defaultNow(),
  },
  (t) => [unique("schedules_year_month_unique").on(t.year, t.month)],
)

export const scheduleShifts = pgTable(
  "schedule_shifts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scheduleId: uuid("schedule_id").references(() => schedules.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    shiftType: text("shift_type").notNull(), // 'Morning' | 'Night' | 'Overnight' | 'Off' | 'Comp Off'
  },
  (t) => [unique("schedule_shifts_unique").on(t.scheduleId, t.employeeId, t.date)],
)

export type Team = typeof teams.$inferSelect
export type NewTeam = typeof teams.$inferInsert
export type Employee = typeof employees.$inferSelect
export type NewEmployee = typeof employees.$inferInsert
export type Schedule = typeof schedules.$inferSelect
export type NewSchedule = typeof schedules.$inferInsert
export type ScheduleShift = typeof scheduleShifts.$inferSelect
export type NewScheduleShift = typeof scheduleShifts.$inferInsert
