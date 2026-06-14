import { create } from 'zustand';

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
