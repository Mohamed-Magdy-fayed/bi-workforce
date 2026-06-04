import * as XLSX from "xlsx"
import type { MonthSchedule } from "./types"

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export function buildXlsxBuffer(schedule: MonthSchedule): Uint8Array {
  const { year, month, days, employees, teams } = schedule
  const teamMap = new Map(teams.map((t) => [t.id, t.name]))

  // Header row: Date + one column per employee
  const headerRow = [
    "Date",
    ...employees.map((e) => `${e.name}\n(${teamMap.get(e.teamId) ?? ""})`),
  ]

  const dataRows: string[][] = days.map((day) => {
    const d = new Date(day.date + "T00:00:00")
    const label = `${DAY_NAMES[day.dayOfWeek]} ${d.getDate()} ${MONTH_NAMES[month - 1].slice(0, 3)}`
    const cells = employees.map((emp) => {
      const assignment = day.assignments.find((a) => a.employeeId === emp.id)
      return assignment?.shiftType ?? "Off"
    })
    return [label, ...cells]
  })

  const wsData = [headerRow, ...dataRows]
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Column widths
  ws["!cols"] = [
    { wch: 18 }, // Date column
    ...employees.map(() => ({ wch: 16 })),
  ]

  // Freeze first row and first column
  ws["!freeze"] = { xSplit: 1, ySplit: 1 }

  const wb = XLSX.utils.book_new()
  const sheetName = `${MONTH_NAMES[month - 1]} ${year}`
  XLSX.utils.book_append_sheet(wb, ws, sheetName)

  // Legend sheet
  const legendData = [
    ["Shift", "Description"],
    ["Morning", "9:00 AM – 5:00 PM"],
    ["Night", "4:00 PM – 12:00 AM"],
    ["Overnight", "3:00 AM – 11:00 AM"],
    ["Off", "Day off"],
    ["Comp Off", "Compensatory day off (for working Friday)"],
  ]
  const legendWs = XLSX.utils.aoa_to_sheet(legendData)
  legendWs["!cols"] = [{ wch: 14 }, { wch: 36 }]
  XLSX.utils.book_append_sheet(wb, legendWs, "Legend")

  return XLSX.write(wb, { bookType: "xlsx", type: "array" }) as Uint8Array
}
