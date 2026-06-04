import { NextResponse } from "next/server"
import { db } from "@/db"
import { scheduleShifts, schedules } from "@/db/schema"
import { and, desc, eq } from "drizzle-orm"

export async function GET() {
  try {
    const rows = await db
      .select({
        id: schedules.id,
        year: schedules.year,
        month: schedules.month,
        hasViolations: schedules.hasViolations,
        generatedAt: schedules.generatedAt,
      })
      .from(schedules)
      .orderBy(desc(schedules.year), desc(schedules.month))
    return NextResponse.json(rows)
  } catch {
    return NextResponse.json({ error: "Failed to fetch schedules" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { year, month, hasViolations, days } = body

    if (!year || !month || !days) {
      return NextResponse.json({ error: "year, month and days are required" }, { status: 400 })
    }

    // Delete existing schedule for this year+month (cascade deletes shifts)
    await db.delete(schedules).where(and(eq(schedules.year, year), eq(schedules.month, month)))

    // Insert new schedule header
    const [schedule] = await db
      .insert(schedules)
      .values({ year, month, hasViolations: hasViolations ?? false })
      .returning()

    // Insert all shift assignments
    const shiftRows: {
      scheduleId: string
      employeeId: string
      date: string
      shiftType: string
    }[] = []

    for (const day of days) {
      for (const assignment of day.assignments) {
        shiftRows.push({
          scheduleId: schedule.id,
          employeeId: assignment.employeeId,
          date: day.date,
          shiftType: assignment.shiftType,
        })
      }
    }

    if (shiftRows.length > 0) {
      // Insert in batches to avoid query size limits
      const BATCH = 500
      for (let i = 0; i < shiftRows.length; i += BATCH) {
        await db.insert(scheduleShifts).values(shiftRows.slice(i, i + BATCH))
      }
    }

    return NextResponse.json({ id: schedule.id }, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Failed to save schedule" }, { status: 500 })
  }
}
