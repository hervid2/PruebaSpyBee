'use client';
import { useReducedMotion, type Variants } from 'motion/react';

// $transition-normal in _variables.scss, so entrance motion moves at the
// same speed as the rest of the interface.
const DURATION = 0.25;
// requirements.md §1.11 (Must): reduced motion collapses to a short cross-fade.
const REDUCED_DURATION = 0.1;

/**
 * Fade+rise variants for content that enters on mount or scrolls into view.
 * Meant for `initial="hidden"` with either `animate="visible"` (mount) or
 * `whileInView="visible"` (scroll-triggered) — the dashboard's lower sections
 * use the latter so their entrance actually plays when scrolled into view,
 * instead of finishing off-screen before the user ever sees it.
 */
export function useRevealVariants(): Variants {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: REDUCED_DURATION } },
    };
  }

  return {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: DURATION } },
  };
}
