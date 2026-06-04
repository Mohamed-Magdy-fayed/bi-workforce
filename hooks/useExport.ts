"use client"

import { buildXlsxBuffer } from "@/lib/scheduler/export"
import type { MonthSchedule } from "@/lib/scheduler/types"

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

export function useExport() {
  const exportSchedule = (schedule: MonthSchedule) => {
    const buffer = buildXlsxBuffer(schedule)
    const blob = new Blob([buffer as unknown as ArrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `schedule-${MONTH_NAMES[schedule.month - 1]}-${schedule.year}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return { exportSchedule }
}
