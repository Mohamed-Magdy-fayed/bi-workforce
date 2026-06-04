"use client"

import { useCallback, useEffect, useState } from "react"

export interface TeamRow {
  id: string
  name: string
  createdAt: string | null
}

export function useTeams() {
  const [teams, setTeams] = useState<TeamRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/teams")
      if (!res.ok) throw new Error("Failed to load teams")
      setTeams(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const create = async (name: string) => {
    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) throw new Error("Failed to create team")
    await load()
  }

  const update = async (id: string, name: string) => {
    const res = await fetch(`/api/teams/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) throw new Error("Failed to update team")
    await load()
  }

  const remove = async (id: string) => {
    const res = await fetch(`/api/teams/${id}`, { method: "DELETE" })
    if (!res.ok) throw new Error("Failed to delete team")
    await load()
  }

  return { teams, loading, error, create, update, remove, reload: load }
}
