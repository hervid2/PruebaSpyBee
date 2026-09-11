/**
 * WCAG contrast arithmetic and palette lookup shared by the stylesheet
 * contrast tests. Colours are read from `_variables.scss` itself, so a test
 * checks the value the build compiles rather than a copy that can drift.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

export type Rgb = [number, number, number];

export const SRC = path.resolve(__dirname, '..', '..', 'src');

export const VARIABLES = readFileSync(
  path.join(SRC, 'styles', 'abstracts', '_variables.scss'),
  'utf-8',
);

export const AA_NORMAL_TEXT = 4.5;
export const WHITE: Rgb = [255, 255, 255];

export function token(name: string): Rgb {
  const match = new RegExp(`\\${name}:\\s*#([0-9a-fA-F]{6});`).exec(VARIABLES);
  if (!match) throw new Error(`${name} is not a six-digit colour in _variables.scss`);
  const hex = match[1];
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
}

export function luminance([r, g, b]: Rgb): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a: Rgb, b: Rgb): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

/** An rgba() tint composited over the opaque surface beneath it. */
export function over(color: Rgb, alpha: number, base: Rgb): Rgb {
  return color.map((c, i) => alpha * c + (1 - alpha) * base[i]) as Rgb;
}
