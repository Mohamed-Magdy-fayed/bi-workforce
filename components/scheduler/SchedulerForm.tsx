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
import type {
  ScheduleEmployee,
  ScheduleTeam,
  ShiftRequirements,
} from "@/lib/scheduler/types"
import { DEFAULT_SHIFT_REQUIREMENTS } from "@/lib/scheduler/types"

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
  onGenerate: (
    year: number,
    month: number,
    requirements: ShiftRequirements
  ) => void
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function ReqInput({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  return (
    <Input
      type="number"
      value={value}
      min={0}
      max={6}
      className="h-7 w-14 text-center text-xs"
      onChange={(e) => onChange(clamp(parseInt(e.target.value) || 0, 0, 6))}
    />
  )
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
  const [req, setReq] = useState<ShiftRequirements>(DEFAULT_SHIFT_REQUIREMENTS)

  const canGenerate = employees.length >= 3 && teams.length >= 1

  const teamMap = new Map(teams.map((t) => [t.id, t.name]))

  // Warn if required slots exceed available regulars
  const regularCount = employees.filter((e) => e.role === "regular").length
  const maxSlots = Math.max(
    req.normalDay.overnight + req.normalDay.night,
    req.friday.overnight + req.friday.night + req.friday.morning,
    req.saturday.overnight + req.saturday.night + req.saturday.morning
  )
  const slotsWarning = maxSlots > regularCount

  function setNormal(field: "overnight" | "night", v: number) {
    setReq((r) => ({ ...r, normalDay: { ...r.normalDay, [field]: v } }))
  }
  function setFriday(field: "overnight" | "night" | "morning", v: number) {
    setReq((r) => ({ ...r, friday: { ...r.friday, [field]: v } }))
  }
  function setSaturday(field: "overnight" | "night" | "morning", v: number) {
    setReq((r) => ({ ...r, saturday: { ...r.saturday, [field]: v } }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onGenerate(parseInt(year), parseInt(month), req)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Generate Schedule</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
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
          </div>

          {/* Shift Requirements */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Shift Requirements
            </p>
            <div className="overflow-x-auto">
              <table className="text-xs">
                <thead>
                  <tr>
                    <th className="w-28 pb-1.5 text-left font-normal text-muted-foreground" />
                    <th className="px-3 pb-1.5 text-center font-medium">
                      Overnight
                    </th>
                    <th className="px-3 pb-1.5 text-center font-medium">
                      Night
                    </th>
                    <th className="px-3 pb-1.5 text-center font-medium">
                      Morning
                    </th>
                  </tr>
                </thead>
                <tbody className="[&>tr>td]:py-1">
                  <tr>
                    <td className="pr-3 text-muted-foreground">Normal day</td>
                    <td className="px-3 text-center">
                      <ReqInput
                        value={req.normalDay.overnight}
                        onChange={(v) => setNormal("overnight", v)}
                      />
                    </td>
                    <td className="px-3 text-center">
                      <ReqInput
                        value={req.normalDay.night}
                        onChange={(v) => setNormal("night", v)}
                      />
                    </td>
                    <td className="px-3 text-center">
                      <span className="text-[0.65rem] text-muted-foreground">
                        auto
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="pr-3 text-muted-foreground">Friday</td>
                    <td className="px-3 text-center">
                      <ReqInput
                        value={req.friday.overnight}
                        onChange={(v) => setFriday("overnight", v)}
                      />
                    </td>
                    <td className="px-3 text-center">
                      <ReqInput
                        value={req.friday.night}
                        onChange={(v) => setFriday("night", v)}
                      />
                    </td>
                    <td className="px-3 text-center">
                      <ReqInput
                        value={req.friday.morning}
                        onChange={(v) => setFriday("morning", v)}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="pr-3 text-muted-foreground">
                      Saturday
                      <span className="ml-1 text-[0.6rem] text-muted-foreground">
                        +leader
                      </span>
                    </td>
                    <td className="px-3 text-center">
                      <ReqInput
                        value={req.saturday.overnight}
                        onChange={(v) => setSaturday("overnight", v)}
                      />
                    </td>
                    <td className="px-3 text-center">
                      <ReqInput
                        value={req.saturday.night}
                        onChange={(v) => setSaturday("night", v)}
                      />
                    </td>
                    <td className="px-3 text-center">
                      <ReqInput
                        value={req.saturday.morning}
                        onChange={(v) => setSaturday("morning", v)}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            {slotsWarning && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Required slots may exceed available regular employees (
                {regularCount}). Some shifts may be understaffed.
              </p>
            )}
          </div>
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
