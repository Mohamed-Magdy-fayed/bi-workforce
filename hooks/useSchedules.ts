"use client"

import { useCallback, useEffect, useState } from "react"

export interface ScheduleListItem {
  id: string
  year: number
  month: number
  hasViolations: boolean
  generatedAt: string | null
}

export function useScheduleList() {
  const [schedules, setSchedules] = useState<ScheduleListItem[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/schedules")
      if (!res.ok) return
      setSchedules(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const remove = async (id: string) => {
    await fetch(`/api/schedules/${id}`, { method: "DELETE" })
    await load()
  }

  return { schedules, loading, remove, reload: load }
}
