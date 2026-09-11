/**
 * Holds every accessible foreground token in `_variables.scss` to the rule its
 * own comment states: "the lightest value of the same hue and saturation that
 * clears 4.5:1 against white, $color-bg-muted and its own 10%/12% tint".
 *
 * That rule was checked by hand when the tokens were introduced in F9.7, and
 * `$color-info-blue-text`, added afterwards for a different job (white text on
 * a blue fill), was never measured against its own tint. It sat at 4.49:1
 * there. Nothing could see it: the history view's "Editada" badge is the one
 * place blue text sits on that tint, and until the seed wrote an audit trail
 * there was no row to render the badge in, so the axe audit passed an empty
 * table. The first run with real rows failed on it.
 *
 * Each `$color-<name>-text` token is paired with `$color-<name>`, its fill.
 * A new text token without a fill of the same name fails here on purpose, so
 * it has to arrive with the pair it is meant to be read against.
 */
import { describe, it, expect } from 'vitest';
import { AA_NORMAL_TEXT, VARIABLES, WHITE, contrast, over, token, type Rgb } from './contrast';

const TEXT_TOKENS = [...VARIABLES.matchAll(/^(\$color-[\w-]+)-text:/gm)].map((m) => m[1]);

describe('accessible foreground tokens', () => {
  it('finds the text tokens it checks', () => {
    // An empty match would make every case below vacuous.
    expect(TEXT_TOKENS).toEqual(
      expect.arrayContaining(['$color-status-open', '$color-priority-high', '$color-info-blue']),
    );
  });

  const muted = token('$color-bg-muted');
  const cases: [string, string, Rgb][] = TEXT_TOKENS.flatMap((fill) => {
    const base = token(fill);
    return [
      [`${fill}-text`, 'white', WHITE],
      [`${fill}-text`, '$color-bg-muted', muted],
      [`${fill}-text`, `its own 10% tint`, over(base, 0.1, WHITE)],
      [`${fill}-text`, `its own 12% tint`, over(base, 0.12, WHITE)],
    ] as [string, string, Rgb][];
  });

  it.each(cases)('%s clears WCAG AA on %s', (name, _background, background) => {
    expect(contrast(token(name), background)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });
});
