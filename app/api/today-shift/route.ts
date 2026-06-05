import { NextResponse } from "next/server"
import { db } from "@/db"
import { employees, scheduleShifts, schedules, teams } from "@/db/schema"
import { and, eq } from "drizzle-orm"

function activeShift(hour: number): string {
  if (hour >= 7 && hour < 15) return "Morning"
  if (hour >= 15 && hour < 23) return "Night"
  return "Overnight"
}

export async function GET() {
  try {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const todayStr = `${year}-${String(month).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
    const shift = activeShift(now.getHours())

    const [schedule] = await db
      .select({ id: schedules.id })
      .from(schedules)
      .where(and(eq(schedules.year, year), eq(schedules.month, month)))
      .limit(1)

    if (!schedule) {
      return NextResponse.json({
        date: todayStr,
        shift,
        teams: [],
        noSchedule: true,
      })
    }

    const [todayShifts, allEmployees, allTeams] = await Promise.all([
      db
        .select({
          employeeId: scheduleShifts.employeeId,
          shiftType: scheduleShifts.shiftType,
        })
        .from(scheduleShifts)
        .where(
          and(
            eq(scheduleShifts.scheduleId, schedule.id),
            eq(scheduleShifts.date, todayStr)
          )
        ),
      db
        .select({
          id: employees.id,
          name: employees.name,
          teamId: employees.teamId,
          role: employees.role,
        })
        .from(employees),
      db.select({ id: teams.id, name: teams.name }).from(teams),
    ])

    // Only keep employees on the currently-active shift
    const onShift = new Set(
      todayShifts.filter((s) => s.shiftType === shift).map((s) => s.employeeId)
    )

    const result = allTeams.map((team) => ({
      team,
      members: allEmployees
        .filter((e) => e.teamId === team.id && onShift.has(e.id))
        .map((e) => ({ name: e.name, isLeader: e.role === "team_leader" })),
    }))

    return NextResponse.json({
      date: todayStr,
      shift,
      teams: result,
      noSchedule: false,
    })
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
