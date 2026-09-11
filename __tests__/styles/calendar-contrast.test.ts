/**
 * Contrast of the calendar's day numbers in every intensity state (F9.7).
 *
 * The axe audit cannot promise this on its own: it measures whatever state
 * "today" happens to be in when it runs. That is how a contrast failure in the
 * tinted states got past a green audit, and why it only surfaced once
 * create-incident.spec.ts started filing incidents dated today and a later
 * project's audit met a tinted cell. Reading the stylesheet covers every state,
 * independent of seeded data and of test order.
 *
 * Only the declarations the checks rely on are read, and each one is matched
 * exactly. A changed alpha or a swapped token fails here and has to arrive with
 * its own contrast check, rather than slipping past this one.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { AA_NORMAL_TEXT, SRC, WHITE, contrast, over, token, type Rgb } from './contrast';

// Whitespace collapsed, so the shape checks do not depend on formatting.
const calendar = readFileSync(
  path.join(SRC, 'components', 'calendario', 'CalendarioView.module.scss'),
  'utf-8',
).replace(/\s+/g, ' ');

describe('calendar day contrast', () => {
  const shapes: [string, RegExp][] = [
    ['calendar surface', /\.section \{[^}]*background: \$color-bg-surface;/],
    ['default cell', /\.day \{[^}]*background: \$color-bg-muted;/],
    ['day number', /\.day__num \{[^}]*color: \$color-text-secondary;/],
    ['count badge', /\.day__badge \{[^}]*color: \$color-info-blue-text;/],
    ['--low tint', /&--low \{ background: rgba\(\$color-info-blue, 0\.15\); \}/],
    ['--mid tint', /&--mid \{ background: rgba\(\$color-info-blue, 0\.35\); \}/],
    [
      '--low/--mid text',
      /&--low, &--mid \{ \.day__num, \.day__badge \{ color: \$color-text-primary; \} \}/,
    ],
    [
      '--high fill and text',
      /&--high \{ background: \$color-info-blue-text; \.day__num, \.day__badge \{ color: #fff; \} \}/,
    ],
  ];

  it.each(shapes)('still declares the %s these checks assume', (_name, shape) => {
    expect(calendar).toMatch(shape);
  });

  const surface = token('$color-bg-surface');
  const blue = token('$color-info-blue');
  const cases: [string, Rgb, Rgb][] = [
    ['day number, default', token('$color-text-secondary'), token('$color-bg-muted')],
    ['count badge, default', token('$color-info-blue-text'), token('$color-bg-muted')],
    ['day number and badge, --low', token('$color-text-primary'), over(blue, 0.15, surface)],
    ['day number and badge, --mid', token('$color-text-primary'), over(blue, 0.35, surface)],
    ['day number and badge, --high', WHITE, token('$color-info-blue-text')],
  ];

  it.each(cases)('%s clears WCAG AA for normal text', (_name, foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });
});
