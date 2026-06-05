"use client"

import { useEffect, useState } from "react"

export interface TodayMember {
  name: string
  isLeader: boolean
}

export interface TodayTeamCoverage {
  team: { id: string; name: string }
  members: TodayMember[]
}

export interface TodayShiftData {
  date: string
  shift: string
  teams: TodayTeamCoverage[]
  noSchedule: boolean
}

export function useTodayLeaders() {
  const [data, setData] = useState<TodayShiftData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/today-shift")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return { data, loading }
}
