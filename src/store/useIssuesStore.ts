'use client';
/**
 * Central store for the incident collection. Unlike the other stores it is
 * context-scoped (a per-render store created with `createStore` + a Provider)
 * so the server component can seed it with incidents fetched at request time,
 * avoiding a client refetch and SSR/global-singleton state bleed.
 */
import React, { createContext, useContext, useState } from 'react';
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import type { Incident } from '@/domain/models';

interface IssuesState {
  incidents: Incident[];
  addIncident: (incident: Incident) => void;
  updateIncident: (incident: Incident) => void;
  removeIncident: (id: string) => void;
}

/** Factory for a fresh store instance seeded with server-fetched incidents. */
export const createIssuesStore = (initialIncidents: Incident[] = []) =>
  createStore<IssuesState>()((set) => ({
    incidents: initialIncidents,
    // Prepend so newly created incidents surface at the top of lists.
    addIncident: (incident) => set((state) => ({ incidents: [incident, ...state.incidents] })),
    // Replaces the incident by id in place (status change, media attached, future edits).
    updateIncident: (incident) =>
      set((state) => ({
        incidents: state.incidents.map((i) => (i.id === incident.id ? incident : i)),
      })),
    removeIncident: (id) =>
      set((state) => ({ incidents: state.incidents.filter((i) => i.id !== id) })),
  }));

export type IssuesStoreApi = ReturnType<typeof createIssuesStore>;

export const IssuesStoreContext = createContext<IssuesStoreApi | null>(null);

/**
 * Provides a single store instance to the tree, created once per mount.
 *
 * The store is held in `useState`'s lazy initialiser rather than the
 * `useRef`-and-assign-on-first-render form Zustand's own docs show (F9.7).
 * Both create the store exactly once, but the ref version has to *read*
 * `ref.current` during render to pass it down, which `react-hooks/refs`
 * flags: under concurrent rendering a render can be thrown away and
 * restarted, and a ref written during render survives that discard while
 * state does not. `useState` gives the same create-once semantics with a
 * value the renderer actually owns.
 */
export function IssuesStoreProvider({
  children,
  initialIncidents,
}: {
  children: React.ReactNode;
  initialIncidents: Incident[];
}) {
  const [store] = useState<IssuesStoreApi>(() => createIssuesStore(initialIncidents));
  return React.createElement(IssuesStoreContext.Provider, { value: store }, children);
}

/** Selector hook; throws if used outside {@link IssuesStoreProvider}. */
export function useIssuesStore<T>(selector: (state: IssuesState) => T): T {
  const store = useContext(IssuesStoreContext);
  if (!store) throw new Error('useIssuesStore debe usarse dentro de IssuesStoreProvider');
  return useStore(store, selector);
}
