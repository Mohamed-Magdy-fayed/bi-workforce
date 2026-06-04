import { NextResponse } from "next/server"
import { db } from "@/db"
import { teams } from "@/db/schema"
import { eq } from "drizzle-orm"

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { name } = await req.json()
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }
    const [row] = await db
      .update(teams)
      .set({ name: name.trim() })
      .where(eq(teams.id, id))
      .returning()
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(row)
  } catch {
    return NextResponse.json({ error: "Failed to update team" }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.delete(teams).where(eq(teams.id, id))
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to delete team" }, { status: 500 })
  }
}
