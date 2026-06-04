import { NextResponse } from "next/server"
import { db } from "@/db"
import { employees, teams } from "@/db/schema"
import { asc, eq } from "drizzle-orm"

export async function GET() {
  try {
    const rows = await db
      .select({
        id: employees.id,
        name: employees.name,
        teamId: employees.teamId,
        seniority: employees.seniority,
        role: employees.role,
        createdAt: employees.createdAt,
        teamName: teams.name,
      })
      .from(employees)
      .leftJoin(teams, eq(employees.teamId, teams.id))
      .orderBy(asc(teams.name), asc(employees.name))
    return NextResponse.json(rows)
  } catch {
    return NextResponse.json({ error: "Failed to fetch employees" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, teamId, seniority, role } = body
    if (!name?.trim() || !seniority || !role) {
      return NextResponse.json({ error: "name, seniority and role are required" }, { status: 400 })
    }
    const [row] = await db
      .insert(employees)
      .values({ name: name.trim(), teamId: teamId || null, seniority, role })
      .returning()
    return NextResponse.json(row, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Failed to create employee" }, { status: 500 })
  }
}
