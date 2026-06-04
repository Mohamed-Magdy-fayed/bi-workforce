"use client"

import { Button } from "@/components/ui/button"
import { useExport } from "@/hooks/useExport"
import type { MonthSchedule } from "@/lib/scheduler/types"

interface ExportButtonProps {
  schedule: MonthSchedule
}

export function ExportButton({ schedule }: ExportButtonProps) {
  const { exportSchedule } = useExport()
  return (
    <Button variant="outline" size="sm" onClick={() => exportSchedule(schedule)}>
      Export Excel
    </Button>
  )
}
