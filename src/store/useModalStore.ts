/**
 * Single-source modal coordinator: only one app-level modal can be open at a
 * time, keyed by {@link ModalId}. Triggers anywhere call `open(id)` and the
 * modal components render based on `activeModal`, avoiding scattered booleans.
 */
import { create } from 'zustand';

/** Identifiers for the mutually-exclusive top-level modals. */
export type ModalId = 'create-issue' | 'category-manager' | 'dashboard-filters';

interface ModalState {
  activeModal: ModalId | null;
  open: (id: ModalId) => void;
  close: () => void;
}

export const useModalStore = create<ModalState>()((set) => ({
  activeModal: null,
  open: (id) => set({ activeModal: id }),
  close: () => set({ activeModal: null }),
}));
