'use client';
/**
 * Central store for the incident collection. Unlike the other stores it is
 * context-scoped (a per-render store created with `createStore` + a Provider)
 * so the server component can seed it with incidents fetched at request time,
 * avoiding a client refetch and SSR/global-singleton state bleed.
 */
import React, { createContext, useContext, useRef } from 'react';
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import type { Incident } from '@/domain/models';

interface IssuesState {
  incidents: Incident[];
  addIncident: (incident: Incident) => void;
}

/** Factory for a fresh store instance seeded with server-fetched incidents. */
export const createIssuesStore = (initialIncidents: Incident[] = []) =>
  createStore<IssuesState>()((set) => ({
    incidents: initialIncidents,
    // Prepend so newly created incidents surface at the top of lists.
    addIncident: (incident) => set((state) => ({ incidents: [incident, ...state.incidents] })),
  }));

export type IssuesStoreApi = ReturnType<typeof createIssuesStore>;

export const IssuesStoreContext = createContext<IssuesStoreApi | null>(null);

/** Provides a single store instance to the tree, created once per mount. */
export function IssuesStoreProvider({
  children,
  initialIncidents,
}: {
  children: React.ReactNode;
  initialIncidents: Incident[];
}) {
  const storeRef = useRef<IssuesStoreApi | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createIssuesStore(initialIncidents);
  }
  return React.createElement(IssuesStoreContext.Provider, { value: storeRef.current }, children);
}

/** Selector hook; throws if used outside {@link IssuesStoreProvider}. */
export function useIssuesStore<T>(selector: (state: IssuesState) => T): T {
  const store = useContext(IssuesStoreContext);
  if (!store) throw new Error('useIssuesStore debe usarse dentro de IssuesStoreProvider');
  return useStore(store, selector);
}
