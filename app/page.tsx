"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { generateSchedule } from "@/lib/scheduler/engine"
import type {
  MonthSchedule,
  ScheduleEmployee,
  ScheduleTeam,
  ShiftRequirements,
} from "@/lib/scheduler/types"
import { useEmployees } from "@/hooks/useEmployees"
import { useTeams } from "@/hooks/useTeams"
import { useScheduleList } from "@/hooks/useSchedules"
import { SchedulerForm } from "@/components/scheduler/SchedulerForm"
import { ScheduleGrid } from "@/components/scheduler/ScheduleGrid"
import { ViolationBanner } from "@/components/scheduler/ViolationBanner"
import { ExportButton } from "@/components/scheduler/ExportButton"
import { TeamManager } from "@/components/scheduler/TeamManager"
import { EmployeeManager } from "@/components/scheduler/EmployeeManager"
import { TodayBanner } from "@/components/scheduler/TodayBanner"

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

export default function Page() {
  const teamsHook = useTeams()
  const employeesHook = useEmployees()
  const schedulesHook = useScheduleList()

  const [generatedSchedule, setGeneratedSchedule] =
    useState<MonthSchedule | null>(null)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [viewingSchedule, setViewingSchedule] = useState<MonthSchedule | null>(
    null
  )
  const [loadingHistory, setLoadingHistory] = useState(false)

  const scheduleTeams: ScheduleTeam[] = teamsHook.teams.map((t) => ({
    id: t.id,
    name: t.name,
  }))

  const teamNameMap = new Map(scheduleTeams.map((t) => [t.id, t.name]))

  // Sort: by team name → leaders first within team → alphabetical by name
  const scheduleEmployees: ScheduleEmployee[] = [...employeesHook.employees]
    .sort((a, b) => {
      const ta = teamNameMap.get(a.teamId ?? "") ?? ""
      const tb = teamNameMap.get(b.teamId ?? "") ?? ""
      if (ta !== tb) return ta.localeCompare(tb)
      if (a.role !== b.role) return a.role === "team_leader" ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    .map((e) => ({
      id: e.id,
      name: e.name,
      teamId: e.teamId ?? "",
      seniority: e.seniority as ScheduleEmployee["seniority"],
      role: e.role as ScheduleEmployee["role"],
    }))

  const handleGenerate = (
    year: number,
    month: number,
    requirements: ShiftRequirements
  ) => {
    setGenerating(true)
    setSavedId(null)
    try {
      const schedule = generateSchedule({
        year,
        month,
        employees: scheduleEmployees,
        teams: scheduleTeams,
        shiftRequirements: requirements,
      })
      setGeneratedSchedule(schedule)
    } finally {
      setGenerating(false)
    }
  }

  const handleSave = async () => {
    if (!generatedSchedule) return
    setSaving(true)
    try {
      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: generatedSchedule.year,
          month: generatedSchedule.month,
          hasViolations: generatedSchedule.hasViolations,
          days: generatedSchedule.days,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setSavedId(data.id)
        schedulesHook.reload()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleLoadHistory = async (id: string) => {
    setLoadingHistory(true)
    try {
      const res = await fetch(`/api/schedules/${id}`)
      if (!res.ok) return
      const data = await res.json()

      // Reconstruct MonthSchedule from API response
      const employees: ScheduleEmployee[] = data.employees.map(
        (e: ScheduleEmployee) => ({
          id: e.id,
          name: e.name,
          teamId: e.teamId ?? "",
          seniority: e.seniority,
          role: e.role,
        })
      )

      const teams: ScheduleTeam[] = data.teams.map((t: ScheduleTeam) => ({
        id: t.id,
        name: t.name,
      }))

      // Reconstruct full day data from flat shifts
      const { year, month } = data
      const daysInMonth = new Date(year, month, 0).getDate()
      const days = []
      for (let d = 1; d <= daysInMonth; d++) {
        const mm = String(month).padStart(2, "0")
        const dd = String(d).padStart(2, "0")
        const dateStr = `${year}-${mm}-${dd}`
        const dt = new Date(year, month - 1, d)
        const dayOfWeek = dt.getDay()
        const isFriday = dayOfWeek === 5
        const isSaturday = dayOfWeek === 6
        const dayData = data.days.find(
          (x: { date: string }) => x.date === dateStr
        )

        days.push({
          date: dateStr,
          dayOfWeek,
          isFriday,
          isSaturday,
          isWeekend: isFriday || isSaturday,
          assignments: dayData?.assignments ?? [],
          violatedConstraints: [],
        })
      }

      setViewingSchedule({
        id: data.id,
        year: data.year,
        month: data.month,
        days,
        employees,
        teams,
        hasViolations: data.hasViolations,
        summary: {
          totalViolations: 0,
          violationsByDate: {},
          employeeStats: {},
        },
      })
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleDeleteHistory = async (id: string) => {
    await schedulesHook.remove(id)
    if (viewingSchedule?.id === id) setViewingSchedule(null)
  }

  return (
    <div className="min-h-svh p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-base font-semibold">Workforce Scheduler</h1>
          <p className="text-xs text-muted-foreground">
            Generate and manage monthly shift schedules
          </p>
        </div>

        <TodayBanner />

        <Tabs defaultValue="generate">
          <TabsList className="mb-4">
            <TabsTrigger value="generate">Generate</TabsTrigger>
            <TabsTrigger value="history">
              History
              {schedulesHook.schedules.length > 0 && (
                <Badge variant="secondary" className="ms-1 h-4 text-[0.6rem]">
                  {schedulesHook.schedules.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Generate Tab */}
          <TabsContent value="generate">
            <div className="space-y-4">
              <SchedulerForm
                employees={scheduleEmployees}
                teams={scheduleTeams}
                loading={generating}
                onGenerate={handleGenerate}
              />

              {generatedSchedule && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={saving || !!savedId}
                      variant={savedId ? "secondary" : "default"}
                    >
                      {savedId
                        ? "Saved ✓"
                        : saving
                          ? "Saving…"
                          : "Save Schedule"}
                    </Button>
                    <ExportButton schedule={generatedSchedule} />
                    {generatedSchedule.hasViolations && (
                      <Badge variant="destructive" className="text-xs">
                        {generatedSchedule.summary.totalViolations} violation
                        {generatedSchedule.summary.totalViolations !== 1
                          ? "s"
                          : ""}
                      </Badge>
                    )}
                  </div>

                  <ViolationBanner schedule={generatedSchedule} />
                  <ScheduleGrid schedule={generatedSchedule} />

                  {/* Balance summary */}
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Balance Summary
                    </p>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="border-b">
                            <th className="pr-4 pb-1 text-left font-medium text-muted-foreground">
                              Employee
                            </th>
                            <th className="px-2 pb-1 text-center font-medium text-muted-foreground">
                              Morning
                            </th>
                            <th className="px-2 pb-1 text-center font-medium text-muted-foreground">
                              Night
                            </th>
                            <th className="px-2 pb-1 text-center font-medium text-muted-foreground">
                              Overnight
                            </th>
                            <th className="px-2 pb-1 text-center font-medium text-muted-foreground">
                              Fridays
                            </th>
                            <th className="px-2 pb-1 text-center font-medium text-muted-foreground">
                              Saturdays
                            </th>
                            <th className="px-2 pb-1 text-center font-medium text-muted-foreground">
                              Off
                            </th>
                            <th className="px-2 pb-1 text-center font-medium text-muted-foreground">
                              Total Worked
                            </th>
                            <th className="pb-1 pl-2 text-center font-medium text-muted-foreground">
                              Comp. Units
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {generatedSchedule.employees.map((emp) => {
                            const stats =
                              generatedSchedule.summary.employeeStats[emp.id]
                            if (!stats) return null
                            return (
                              <tr
                                key={emp.id}
                                className="border-b last:border-0"
                              >
                                <td className="py-1 pr-4 font-medium">
                                  {emp.name}
                                </td>
                                <td className="px-2 py-1 text-center">
                                  {stats.morning}
                                </td>
                                <td className="px-2 py-1 text-center">
                                  {stats.night}
                                </td>
                                <td className="px-2 py-1 text-center">
                                  {stats.overnight}
                                </td>
                                <td className="px-2 py-1 text-center">
                                  {stats.friday}
                                </td>
                                <td className="px-2 py-1 text-center">
                                  {stats.saturday}
                                </td>
                                <td className="px-2 py-1 text-center">
                                  {stats.off + stats.compOff}
                                </td>
                                <td className="px-2 py-1 text-center font-medium">
                                  {stats.totalWorked}
                                </td>
                                <td className="py-1 pl-2 text-center font-medium tabular-nums">
                                  {stats.compensationUnits.toFixed(2)}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <div className="space-y-4">
              {schedulesHook.schedules.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No saved schedules yet.
                </p>
              )}

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {schedulesHook.schedules.map((s) => (
                  <Card
                    key={s.id}
                    className={`cursor-pointer transition-colors hover:bg-muted/30 ${viewingSchedule?.id === s.id ? "ring-2 ring-ring" : ""}`}
                    onClick={() => handleLoadHistory(s.id)}
                  >
                    <CardHeader className="pt-3 pb-2">
                      <CardTitle className="flex items-center justify-between text-xs">
                        <span>
                          {MONTH_NAMES[s.month - 1]} {s.year}
                        </span>
                        {s.hasViolations ? (
                          <Badge
                            variant="destructive"
                            className="text-[0.6rem]"
                          >
                            violations
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[0.6rem]">
                            ✓ clean
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-3">
                      <p className="text-[0.65rem] text-muted-foreground">
                        {s.generatedAt
                          ? new Date(s.generatedAt).toLocaleDateString()
                          : ""}
                      </p>
                      <Button
                        size="xs"
                        variant="destructive"
                        className="mt-2"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteHistory(s.id)
                        }}
                      >
                        Delete
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {viewingSchedule && (
                <div className="space-y-3 pt-2">
                  <Separator />
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs font-medium">
                      {MONTH_NAMES[viewingSchedule.month - 1]}{" "}
                      {viewingSchedule.year}
                    </h2>
                    {loadingHistory && (
                      <span className="text-xs text-muted-foreground">
                        Loading…
                      </span>
                    )}
                    <ExportButton schedule={viewingSchedule} />
                  </div>
                  <ScheduleGrid schedule={viewingSchedule} />
                </div>
              )}
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <div className="grid gap-4 sm:grid-cols-2">
              <TeamManager
                teams={teamsHook.teams}
                onCreate={teamsHook.create}
                onUpdate={teamsHook.update}
                onDelete={teamsHook.remove}
              />
              <EmployeeManager
                employees={employeesHook.employees}
                teams={teamsHook.teams}
                onCreate={employeesHook.create}
                onUpdate={employeesHook.update}
                onDelete={employeesHook.remove}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
