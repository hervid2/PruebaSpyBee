/**
 * Unit tests for the modal store. Verifies the single-active-modal invariant:
 * open sets/switches the active modal, close clears it, and close is idempotent.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useModalStore } from '@/store/useModalStore';

describe('useModalStore', () => {
  beforeEach(() => {
    useModalStore.setState({ activeModal: null });
  });

  it('arranca sin ningún modal activo', () => {
    expect(useModalStore.getState().activeModal).toBeNull();
  });

  it('open establece el modal activo', () => {
    useModalStore.getState().open('create-issue');
    expect(useModalStore.getState().activeModal).toBe('create-issue');
  });

  it('open puede cambiar entre distintos modales', () => {
    useModalStore.getState().open('create-issue');
    useModalStore.getState().open('dashboard-filters');
    expect(useModalStore.getState().activeModal).toBe('dashboard-filters');
  });

  it('close pone activeModal en null', () => {
    useModalStore.getState().open('category-manager');
    useModalStore.getState().close();
    expect(useModalStore.getState().activeModal).toBeNull();
  });

  it('close es idempotente cuando ya no hay modal activo', () => {
    useModalStore.getState().close();
    expect(useModalStore.getState().activeModal).toBeNull();
  });
});
