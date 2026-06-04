"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { useEmployees } from "@/hooks/useEmployees"
import type { useTeams } from "@/hooks/useTeams"

type EmpHook = ReturnType<typeof useEmployees>
type TeamsHook = ReturnType<typeof useTeams>

interface EmployeeManagerProps {
  employees: EmpHook["employees"]
  teams: TeamsHook["teams"]
  onCreate: EmpHook["create"]
  onUpdate: EmpHook["update"]
  onDelete: EmpHook["remove"]
}

const BLANK = {
  name: "",
  teamId: "",
  seniority: "junior" as const,
  role: "regular" as const,
}

export function EmployeeManager({
  employees,
  teams,
  onCreate,
  onUpdate,
  onDelete,
}: EmployeeManagerProps) {
  const [form, setForm] = useState(BLANK)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(BLANK)

  const handleCreate = async () => {
    if (!form.name.trim() || !form.teamId) return
    await onCreate({
      name: form.name.trim(),
      teamId: form.teamId,
      seniority: form.seniority,
      role: form.role,
    })
    setForm(BLANK)
  }

  const startEdit = (emp: EmpHook["employees"][number]) => {
    setEditingId(emp.id)
    setEditForm({
      name: emp.name,
      teamId: emp.teamId ?? "",
      seniority: emp.seniority as typeof BLANK.seniority,
      role: emp.role as typeof BLANK.role,
    })
  }

  const handleUpdate = async () => {
    if (!editingId || !editForm.name.trim() || !editForm.teamId) return
    await onUpdate(editingId, {
      name: editForm.name.trim(),
      teamId: editForm.teamId,
      seniority: editForm.seniority,
      role: editForm.role,
    })
    setEditingId(null)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Employees</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add form */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="h-7 text-xs"
          />
          <Select
            value={form.teamId}
            onValueChange={(v) => setForm({ ...form, teamId: v ?? "" })}
          >
            <SelectTrigger className="h-7 w-full text-xs">
              <SelectValue placeholder="Team" />
            </SelectTrigger>
            <SelectContent>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={form.seniority}
            onValueChange={(v) =>
              setForm({ ...form, seniority: v as typeof BLANK.seniority })
            }
          >
            <SelectTrigger className="h-7 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="junior">Junior</SelectItem>
              <SelectItem value="mid">Mid</SelectItem>
              <SelectItem value="senior">Senior</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={form.role}
            onValueChange={(v) =>
              setForm({ ...form, role: v as typeof BLANK.role })
            }
          >
            <SelectTrigger className="h-7 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="regular">Regular</SelectItem>
              <SelectItem value="team_leader">Team Leader</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          size="sm"
          onClick={handleCreate}
          disabled={!form.name.trim() || !form.teamId}
        >
          Add Employee
        </Button>

        {/* Employee list */}
        {employees.length === 0 && (
          <p className="text-xs text-muted-foreground">No employees yet.</p>
        )}

        <div className="space-y-1.5">
          {employees.map((emp) => (
            <div
              key={emp.id}
              className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2"
            >
              {editingId === emp.id ? (
                <>
                  <Input
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, name: e.target.value })
                    }
                    className="h-6 w-32 text-xs"
                  />
                  <Select
                    value={editForm.teamId}
                    onValueChange={(v) =>
                      setEditForm({ ...editForm, teamId: v ?? "" })
                    }
                  >
                    <SelectTrigger className="h-6 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={editForm.seniority}
                    onValueChange={(v) =>
                      setEditForm({
                        ...editForm,
                        seniority: v as typeof BLANK.seniority,
                      })
                    }
                  >
                    <SelectTrigger className="h-6 w-20 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="junior">Junior</SelectItem>
                      <SelectItem value="mid">Mid</SelectItem>
                      <SelectItem value="senior">Senior</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={editForm.role}
                    onValueChange={(v) =>
                      setEditForm({ ...editForm, role: v as typeof BLANK.role })
                    }
                  >
                    <SelectTrigger className="h-6 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="regular">Regular</SelectItem>
                      <SelectItem value="team_leader">Team Leader</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="icon-sm"
                    variant="default"
                    onClick={handleUpdate}
                  >
                    ✓
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => setEditingId(null)}
                  >
                    ✕
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-xs font-medium">{emp.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {emp.teamName}
                  </span>
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.6rem] capitalize">
                    {emp.seniority}
                  </span>
                  {emp.role === "team_leader" && (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[0.6rem] text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                      Leader
                    </span>
                  )}
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => startEdit(emp)}
                  >
                    ✎
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="destructive"
                    onClick={() => onDelete(emp.id)}
                  >
                    ✕
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
