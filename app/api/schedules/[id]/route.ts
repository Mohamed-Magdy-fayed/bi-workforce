import { NextResponse } from "next/server"
import { db } from "@/db"
import { employees, scheduleShifts, schedules, teams } from "@/db/schema"
import { eq } from "drizzle-orm"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const [schedule] = await db.select().from(schedules).where(eq(schedules.id, id))
    if (!schedule) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const shifts = await db
      .select({
        employeeId: scheduleShifts.employeeId,
        date: scheduleShifts.date,
        shiftType: scheduleShifts.shiftType,
      })
      .from(scheduleShifts)
      .where(eq(scheduleShifts.scheduleId, id))

    const allEmployees = await db
      .select({
        id: employees.id,
        name: employees.name,
        teamId: employees.teamId,
        seniority: employees.seniority,
        role: employees.role,
      })
      .from(employees)

    const allTeams = await db.select().from(teams)

    // Reconstruct days structure
    const dayMap = new Map<string, { date: string; assignments: { employeeId: string; shiftType: string }[] }>()
    for (const shift of shifts) {
      const dateStr = shift.date
      if (!dayMap.has(dateStr)) {
        dayMap.set(dateStr, { date: dateStr, assignments: [] })
      }
      dayMap.get(dateStr)!.assignments.push({
        employeeId: shift.employeeId!,
        shiftType: shift.shiftType,
      })
    }

    const days = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({
      id: schedule.id,
      year: schedule.year,
      month: schedule.month,
      hasViolations: schedule.hasViolations,
      generatedAt: schedule.generatedAt,
      days,
      employees: allEmployees,
      teams: allTeams,
    })
  } catch {
    return NextResponse.json({ error: "Failed to fetch schedule" }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.delete(schedules).where(eq(schedules.id, id))
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to delete schedule" }, { status: 500 })
  }
}
