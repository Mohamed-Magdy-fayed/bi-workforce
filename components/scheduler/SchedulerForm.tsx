"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import type { ScheduleEmployee, ScheduleTeam } from "@/lib/scheduler/types"

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

interface SchedulerFormProps {
  employees: ScheduleEmployee[]
  teams: ScheduleTeam[]
  loading: boolean
  onGenerate: (year: number, month: number) => void
}

export function SchedulerForm({
  employees,
  teams,
  loading,
  onGenerate,
}: SchedulerFormProps) {
  const now = new Date()
  const [month, setMonth] = useState(String(now.getMonth() + 1))
  const [year, setYear] = useState(String(now.getFullYear()))

  const canGenerate = employees.length >= 3 && teams.length >= 1

  const teamMap = new Map(teams.map((t) => [t.id, t.name]))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onGenerate(parseInt(year), parseInt(month))
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Generate Schedule</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          onSubmit={handleSubmit}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="space-y-1">
            <Label className="text-xs">Month</Label>
            <Select value={month} onValueChange={(v) => v && setMonth(v)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((name, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Year</Label>
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-24"
              min={2020}
              max={2100}
            />
          </div>
          <Button type="submit" disabled={!canGenerate || loading} size="sm">
            {loading ? "Generating…" : "Generate Schedule"}
          </Button>
        </form>

        {!canGenerate && (
          <p className="text-xs text-muted-foreground">
            Please add at least 3 employees across teams in the Settings tab
            before generating.
          </p>
        )}

        {employees.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              Employees ({employees.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {employees.map((emp) => (
                <span
                  key={emp.id}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
                >
                  {emp.name}
                  <span className="text-[0.6rem] text-muted-foreground">
                    {teamMap.get(emp.teamId) ?? ""}
                    {emp.role === "team_leader" ? " · Leader" : ""}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
