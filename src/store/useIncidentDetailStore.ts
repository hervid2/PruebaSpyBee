/**
 * Tracks which incident is open in the detail modal. Holds only the id (not the
 * full object) so any view — map marker, dashboard list — can open the modal by
 * reference while the modal itself reads the incident from the issues store.
 */
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
