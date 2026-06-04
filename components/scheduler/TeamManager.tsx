"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { useTeams } from "@/hooks/useTeams"

type TeamsHook = ReturnType<typeof useTeams>

interface TeamManagerProps {
  teams: TeamsHook["teams"]
  onCreate: TeamsHook["create"]
  onUpdate: TeamsHook["update"]
  onDelete: TeamsHook["remove"]
}

export function TeamManager({ teams, onCreate, onUpdate, onDelete }: TeamManagerProps) {
  const [newName, setNewName] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")

  const handleCreate = async () => {
    if (!newName.trim()) return
    await onCreate(newName.trim())
    setNewName("")
  }

  const startEdit = (id: string, name: string) => {
    setEditingId(id)
    setEditName(name)
  }

  const handleUpdate = async () => {
    if (!editingId || !editName.trim()) return
    await onUpdate(editingId, editName.trim())
    setEditingId(null)
    setEditName("")
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Teams</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="New team name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            className="h-7 text-xs"
          />
          <Button size="sm" onClick={handleCreate} disabled={!newName.trim()}>
            Add
          </Button>
        </div>

        {teams.length === 0 && (
          <p className="text-xs text-muted-foreground">No teams yet. Add at least one team.</p>
        )}

        <div className="space-y-1.5">
          {teams.map((team) => (
            <div key={team.id} className="flex items-center gap-2 rounded-md border px-3 py-1.5">
              {editingId === team.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleUpdate()}
                    className="h-6 flex-1 text-xs"
                    autoFocus
                  />
                  <Button size="icon-sm" variant="default" onClick={handleUpdate}>✓</Button>
                  <Button size="icon-sm" variant="ghost" onClick={() => setEditingId(null)}>✕</Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-xs">{team.name}</span>
                  <Button size="icon-sm" variant="ghost" onClick={() => startEdit(team.id, team.name)}>
                    ✎
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="destructive"
                    onClick={() => onDelete(team.id)}
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
