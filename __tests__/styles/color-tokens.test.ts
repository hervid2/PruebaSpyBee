/**
 * Guards the palette against the defect F9.7 found late: a stylesheet writing
 * a palette colour as a literal instead of going through its token.
 *
 * Those five declarations survived the whole accessibility pass untouched,
 * because the fix was applied to `$color-text-secondary` and
 * `$color-priority-high` and a literal `#8a8f98` is not that variable. Two of
 * them were inside the incident-detail modal, which axe never saw either,
 * since it is closed while the audit runs. So neither the token change nor the
 * audit could catch them, and only reading the deployed CSS did.
 *
 * The rule is narrow on purpose: a stylesheet may use any hex it likes, except
 * one that duplicates a value the palette already names. `#fff`, `#222` and
 * the rgba() forms of the same colours are all still fine — this is about
 * bypassing a token, not about hex literals.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname, '..', '..', 'src');
const VARIABLES = path.join(SRC, 'styles', 'abstracts', '_variables.scss');

function scssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return scssFiles(full);
    return full.endsWith('.scss') ? [full] : [];
  });
}

/** `$color-x: #aabbcc;` -> Map of lowercase hex to the variable that owns it. */
function paletteByHex(): Map<string, string> {
  const source = readFileSync(VARIABLES, 'utf-8');
  const byHex = new Map<string, string>();
  for (const line of source.split('\n')) {
    const match = /^\s*(\$color-[\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/.exec(line);
    if (match) byHex.set(match[2].toLowerCase(), match[1]);
  }
  return byHex;
}

describe('palette tokens', () => {
  const palette = paletteByHex();

  it('reads the palette out of _variables.scss', () => {
    expect(palette.size).toBeGreaterThan(10);
  });

  it('no stylesheet hardcodes a colour the palette already names', () => {
    const offenders: string[] = [];

    for (const file of scssFiles(SRC)) {
      if (path.resolve(file) === VARIABLES) continue;
      const source = readFileSync(file, 'utf-8');

      source.split('\n').forEach((line, index) => {
        // Only bare hex literals. A data URI encodes `#` as `%23`, and the one
        // that does (IssueForm's select chevron) is deliberate and documented
        // there — this is why the pattern requires a literal `#`.
        for (const hex of line.match(/#[0-9a-fA-F]{6}\b/g) ?? []) {
          const token = palette.get(hex.toLowerCase());
          if (!token) continue;
          const where = path.relative(SRC, file).split(path.sep).join('/');
          offenders.push(`${where}:${index + 1} uses ${hex}; use ${token}`);
        }
      });
    }

    expect(offenders, `Hardcoded palette colours:\n${offenders.join('\n')}`).toEqual([]);
  });
});
