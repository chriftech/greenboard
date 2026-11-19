/**
 * Small CSV helpers shared by export and import: writing cells and files,
 * and reading a file back into rows. Browser only (downloads use the DOM).
 */

/**
 * One CSV cell. Quoted when needed, with quotes doubled. Text starting with
 * = + - @ (or a tab/return) gets a leading apostrophe, so a spreadsheet shows it
 * as text instead of running it as a formula. Import strips it again.
 */
export function csvCell(value: string) {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Rows of cells as CSV text (CRLF line endings, as spreadsheets expect). */
export function toCsv(rows: readonly (readonly string[])[]) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/**
 * Parse CSV text into rows of cells. Handles quoted cells (with commas, quotes
 * and line breaks inside), CRLF or LF line endings, a UTF-8 byte-order mark, and
 * semicolon-separated files (what Excel saves in many European locales).
 */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.slice(0, src.search(/\r?\n|$/));
  const delimiter = !firstLine.includes(",") && firstLine.includes(";") ? ";" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell === "") {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  // Blank lines are kept (so row numbers match the spreadsheet), except at the very end.
  while (rows.length && rows[rows.length - 1].every((c) => c.trim() === "")) rows.pop();
  return rows;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Today as YYYY-MM-DD, for file names. */
export function fileDate(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** "2026-11-19 14:30", in local time. */
export function formatDateTime(ms: number | undefined) {
  if (!ms) return "";
  const d = new Date(ms);
  return `${fileDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Save CSV text as a file. The byte-order mark tells Excel it's UTF-8, so accents and emoji survive. */
export function downloadCsv(fileName: string, csv: string) {
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before freeing the file.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
