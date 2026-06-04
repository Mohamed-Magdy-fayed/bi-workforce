"use client"

import { useCallback, useEffect, useState } from "react"

export interface EmployeeRow {
  id: string
  name: string
  teamId: string | null
  seniority: string
  role: string
  createdAt: string | null
  teamName: string | null
}

export function useEmployees() {
  const [employees, setEmployees] = useState<EmployeeRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/employees")
      if (!res.ok) throw new Error("Failed to load employees")
      setEmployees(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const create = async (data: Omit<EmployeeRow, "id" | "createdAt" | "teamName">) => {
    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error("Failed to create employee")
    await load()
  }

  const update = async (id: string, data: Omit<EmployeeRow, "id" | "createdAt" | "teamName">) => {
    const res = await fetch(`/api/employees/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error("Failed to update employee")
    await load()
  }

  const remove = async (id: string) => {
    const res = await fetch(`/api/employees/${id}`, { method: "DELETE" })
    if (!res.ok) throw new Error("Failed to delete employee")
    await load()
  }

  return { employees, loading, error, create, update, remove, reload: load }
}
