import { NextResponse } from "next/server"
import { db } from "@/db"
import { teams } from "@/db/schema"
import { asc } from "drizzle-orm"

export async function GET() {
  try {
    const rows = await db.select().from(teams).orderBy(asc(teams.createdAt))
    return NextResponse.json(rows)
  } catch {
    return NextResponse.json({ error: "Failed to fetch teams" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { name } = await req.json()
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }
    const [row] = await db.insert(teams).values({ name: name.trim() }).returning()
    return NextResponse.json(row, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Failed to create team" }, { status: 500 })
  }
}
