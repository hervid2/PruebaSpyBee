'use client';
import { useReducedMotion, type Variants } from 'motion/react';

// Mirrors $transition-fast / $transition-normal in _variables.scss, so Motion
// moves at the same speed as the rest of the interface.
const OVERLAY_DURATION = 0.15;
const PANEL_DURATION = 0.25;
// requirements.md §1.11 (Must): reduced motion collapses to a short cross-fade.
const REDUCED_DURATION = 0.1;

const reducedVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: REDUCED_DURATION } },
  exit: { opacity: 0, transition: { duration: REDUCED_DURATION } },
};

/**
 * Enter/exit variants for the overlay + panel pair every dialog-style
 * component shares. Used with `AnimatePresence` so closing animates instead
 * of the panel just unmounting.
 */
export function useDialogMotion(): { overlay: Variants; panel: Variants } {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return { overlay: reducedVariants, panel: reducedVariants };
  }

  return {
    overlay: {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: OVERLAY_DURATION } },
      exit: { opacity: 0, transition: { duration: OVERLAY_DURATION } },
    },
    panel: {
      hidden: { opacity: 0, y: 20 },
      visible: { opacity: 1, y: 0, transition: { duration: PANEL_DURATION } },
      exit: { opacity: 0, y: 20, transition: { duration: PANEL_DURATION } },
    },
  };
}
