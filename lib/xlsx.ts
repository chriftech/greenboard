/**
 * The Excel side of import: the template (with dropdowns) and reading .xlsx files.
 * ExcelJS is large, so it's only loaded when one of these runs, never with the board.
 */

import { PRIORITIES, TAGS } from "./tasks";
import { getCustomTags } from "./tags";
import { ME, getPeople } from "./people";
import { MAX_IMPORT_ROWS } from "./import";

const loadExcel = () => import("exceljs").then((m) => m.default ?? m);

type Worksheet = import("exceljs").Worksheet;
type DataValidation = import("exceljs").DataValidation;

/**
 * One validation (e.g. a dropdown) for a whole range like "B2:B501". ExcelJS supports
 * this at runtime but leaves it out of its type definitions.
 */
function validate(sheet: Worksheet, range: string, rule: DataValidation) {
  (sheet as unknown as { dataValidations: { add(range: string, rule: DataValidation): void } }).dataValidations.add(range, rule);
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Dates in the file are stored in "wall-clock" time: ExcelJS reads and writes them
 * as UTC, so the UTC parts are exactly what the spreadsheet shows.
 */
const wallClock = (y: number, m: number, d: number, h = 0, min = 0) => new Date(Date.UTC(y, m, d, h, min));

function formatWallClock(d: Date) {
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  // A date with no time (midnight) stays date-only, so an End date covers the whole day.
  return d.getUTCHours() === 0 && d.getUTCMinutes() === 0 ? date : `${date} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

const COLUMNS = [
  { header: "Title", key: "title", width: 34 },
  { header: "Status", key: "status", width: 13 },
  { header: "Tag", key: "tag", width: 14 },
  { header: "Priority", key: "priority", width: 12 },
  { header: "Assignee", key: "assignee", width: 16 },
  { header: "Start", key: "start", width: 18 },
  { header: "End", key: "end", width: 18 },
  { header: "Description", key: "description", width: 44 },
];

/** Download greenboard-import-template.xlsx: headings, examples, and dropdowns for the fixed choices. */
export async function downloadImportTemplateXlsx() {
  const ExcelJS = await loadExcel();
  const book = new ExcelJS.Workbook();
  book.creator = "greenboard";

  const sheet = book.addWorksheet("Tasks", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = COLUMNS;
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFC9A9" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2E3349" } };
  header.alignment = { vertical: "middle" };
  header.height = 22;

  // Example rows, dated tomorrow and the day after.
  const now = new Date();
  const day = (offset: number, h: number, min = 0) =>
    wallClock(now.getFullYear(), now.getMonth(), now.getDate() + offset, h, min);
  sheet.addRows([
    { title: "Plan the team offsite", status: "Pending", tag: "Work", priority: "High", assignee: "Me", start: day(1, 9), end: day(1, 11), description: "Shortlist venues\nSend the invites" },
    { title: "Book a dentist appointment", status: "Pending", tag: "Personal", priority: "Medium" },
    { title: "Water the plants", status: "Completed", tag: "Home", priority: "Low" },
    { title: "Draft the newsletter", status: "Pending", tag: "Work", assignee: "Me", start: day(2, 14), end: day(2, 16, 30), description: "Ask for the photos" },
  ]);
  sheet.getColumn("description").alignment = { wrapText: true, vertical: "top" };
  for (const key of ["start", "end"]) sheet.getColumn(key).numFmt = "yyyy-mm-dd hh:mm";

  // The choices for the dropdowns, on a hidden sheet (so the lists can be long).
  const tags = [...TAGS.map((t) => t.label), ...getCustomTags().map((t) => t.label)];
  const people = [ME.name, ...getPeople().map((p) => p.name)];
  const lists: Record<string, string[]> = {
    Status: ["Pending", "Completed"],
    Tag: tags,
    Priority: PRIORITIES.map((p) => p.label),
    Assignee: people,
  };
  const listSheet = book.addWorksheet("Lists", { state: "hidden" });
  const ranges: Record<string, string> = {};
  Object.entries(lists).forEach(([name, values], i) => {
    const col = String.fromCharCode(65 + i); // A, B, C, D
    listSheet.getCell(`${col}1`).value = name;
    values.forEach((v, j) => (listSheet.getCell(`${col}${j + 2}`).value = v));
    ranges[name] = `Lists!$${col}$2:$${col}$${values.length + 1}`;
  });

  // Dropdowns for every row people might fill in.
  const last = MAX_IMPORT_ROWS + 1;
  const dropdown = (column: string, list: string, strict: boolean, prompt: string) =>
    validate(sheet, `${column}2:${column}${last}`, {
      type: "list",
      allowBlank: true,
      formulae: [ranges[list]],
      showInputMessage: true,
      promptTitle: list,
      prompt,
      // Tags and people can be new ones, so typing something else is allowed there.
      showErrorMessage: strict,
      errorStyle: "stop",
      errorTitle: `Pick a ${list.toLowerCase()}`,
      error: `Choose one of the options in the list.`,
    });
  dropdown("B", "Status", true, "Pending or Completed. Leave empty for Pending.");
  dropdown("C", "Tag", false, "Pick a tag, or type a new one (it will be created).");
  dropdown("D", "Priority", true, "Urgent, High, Medium or Low. Leave empty for none.");
  dropdown("E", "Assignee", false, "Pick someone, or type a new name (they’ll be added).");
  for (const column of ["F", "G"]) {
    validate(sheet, `${column}2:${column}${last}`, {
      type: "date",
      operator: "greaterThan",
      allowBlank: true,
      formulae: [new Date(Date.UTC(2000, 0, 1))],
      showInputMessage: true,
      promptTitle: column === "F" ? "Start" : "End",
      prompt: "A date and time, like 2026-11-20 09:00. Fill in both Start and End, or neither.",
      showErrorMessage: true,
      errorStyle: "stop",
      errorTitle: "Not a date",
      error: "Type a date, like 2026-11-20 09:00.",
    });
  }

  const buffer = await book.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "greenboard-import-template.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type CellValue = import("exceljs").CellValue;

/** A cell as text, the way import reads it. */
function cellText(value: CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return formatWallClock(value);
  if (typeof value === "object") {
    if ("richText" in value) return value.richText.map((r) => r.text).join("");
    if ("result" in value) return cellText((value.result ?? null) as CellValue);
    if ("text" in value) return String(value.text);
    if ("error" in value) return "";
  }
  return String(value);
}

/** The first sheet (or the one named "Tasks") as rows of text, ready for previewRows. */
export async function xlsxToRows(data: ArrayBuffer): Promise<string[][]> {
  const ExcelJS = await loadExcel();
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(data);
  const sheet = book.getWorksheet("Tasks") ?? book.worksheets.find((s) => s.state === "visible") ?? book.worksheets[0];
  if (!sheet) return [];

  const width = sheet.getRow(1).cellCount;
  const rows: string[][] = [];
  // Read well past the import limit (blank rows don't count towards it), but stop
  // somewhere, so a huge sheet doesn't hang the page.
  const last = Math.min(sheet.rowCount, MAX_IMPORT_ROWS * 10);
  for (let r = 1; r <= last; r++) {
    const row = sheet.getRow(r);
    const cells: string[] = [];
    for (let c = 1; c <= width; c++) cells.push(cellText(row.getCell(c).value));
    rows.push(cells);
  }
  // Blank rows are kept (so row numbers match the spreadsheet), except at the very end.
  while (rows.length && rows[rows.length - 1].every((c) => c.trim() === "")) rows.pop();
  return rows;
}
