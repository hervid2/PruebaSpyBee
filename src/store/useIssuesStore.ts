'use client';
import React, { createContext, useContext, useRef } from 'react';
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import type { Incident } from '@/domain/models';

interface IssuesState {
  incidents: Incident[];
  addIncident: (incident: Incident) => void;
}

export const createIssuesStore = (initialIncidents: Incident[] = []) =>
  createStore<IssuesState>()((set) => ({
    incidents: initialIncidents,
    addIncident: (incident) => set((state) => ({ incidents: [incident, ...state.incidents] })),
  }));

export type IssuesStoreApi = ReturnType<typeof createIssuesStore>;

export const IssuesStoreContext = createContext<IssuesStoreApi | null>(null);

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

export function useIssuesStore<T>(selector: (state: IssuesState) => T): T {
  const store = useContext(IssuesStoreContext);
  if (!store) throw new Error('useIssuesStore debe usarse dentro de IssuesStoreProvider');
  return useStore(store, selector);
}
