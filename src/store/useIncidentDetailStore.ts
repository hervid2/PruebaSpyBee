import { create } from 'zustand';

interface IncidentDetailState {
  selectedIncidentId: string | null;
  openDetail: (id: string) => void;
  closeDetail: () => void;
}

export const useIncidentDetailStore = create<IncidentDetailState>()((set) => ({
  selectedIncidentId: null,
  openDetail: (id) => set({ selectedIncidentId: id }),
  closeDetail: () => set({ selectedIncidentId: null }),
}));
