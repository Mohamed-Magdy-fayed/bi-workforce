import { NextResponse } from "next/server"
import { db } from "@/db"
import { employees } from "@/db/schema"
import { eq } from "drizzle-orm"

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { name, teamId, seniority, role } = body
    if (!name?.trim() || !seniority || !role) {
      return NextResponse.json({ error: "name, seniority and role are required" }, { status: 400 })
    }
    const [row] = await db
      .update(employees)
      .set({ name: name.trim(), teamId: teamId || null, seniority, role })
      .where(eq(employees.id, id))
      .returning()
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(row)
  } catch {
    return NextResponse.json({ error: "Failed to update employee" }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.delete(employees).where(eq(employees.id, id))
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to delete employee" }, { status: 500 })
  }
}
