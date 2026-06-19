import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import CreateIssueModal from '@/components/modals/create-issue/CreateIssueModal';
import { createIssuesStore, IssuesStoreContext } from '@/store/useIssuesStore';
import { useModalStore } from '@/store/useModalStore';
import type { ReactNode } from 'react';

// ── Mapbox GL mock ────────────────────────────────────────────────────────────
// Required because LocationPicker imports mapbox-gl and runs it inside useEffect.
vi.mock('mapbox-gl', () => {
  function MapMock(this: Record<string, unknown>) {
    this.on = vi.fn();
    this.off = vi.fn();
    this.remove = vi.fn();
    this.addControl = vi.fn();
    this.setProjection = vi.fn();
    this.flyTo = vi.fn();
    this.fitBounds = vi.fn();
    this.getCenter = vi.fn(() => ({ lng: -74.07, lat: 4.71 }));
    this.getZoom = vi.fn(() => 12);
  }

  function MarkerMock(this: Record<string, unknown>) {
    this.setLngLat = vi.fn().mockReturnThis();
    this.setPopup = vi.fn().mockReturnThis();
    this.addTo = vi.fn().mockReturnThis();
    this.remove = vi.fn();
    this.on = vi.fn();
    this.getLngLat = vi.fn(() => ({ lng: -74.07, lat: 4.71 }));
  }

  function PopupMock(this: Record<string, unknown>) {
    this.setHTML = vi.fn().mockReturnThis();
    this.setLngLat = vi.fn().mockReturnThis();
    this.addTo = vi.fn().mockReturnThis();
    this.remove = vi.fn();
  }

  function LngLatBoundsMock(this: Record<string, unknown>, sw: unknown, ne: unknown) {
    this.extend = vi.fn().mockReturnThis();
    this.getSouthWest = vi.fn(() => sw);
    this.getNorthEast = vi.fn(() => ne);
  }

  function NavigationControlMock(this: Record<string, unknown>) {
    this.onAdd = vi.fn();
    this.onRemove = vi.fn();
  }

  function FullscreenControlMock(this: Record<string, unknown>) {
    this.onAdd = vi.fn();
    this.onRemove = vi.fn();
  }

  return {
    default: {
      accessToken: '',
      Map: vi.fn().mockImplementation(function (...args: unknown[]) {
        return new (MapMock as unknown as new (...a: unknown[]) => unknown)(...args);
      }),
      Marker: vi.fn().mockImplementation(function (...args: unknown[]) {
        return new (MarkerMock as unknown as new (...a: unknown[]) => unknown)(...args);
      }),
      Popup: vi.fn().mockImplementation(function (...args: unknown[]) {
        return new (PopupMock as unknown as new (...a: unknown[]) => unknown)(...args);
      }),
      LngLatBounds: vi.fn().mockImplementation(function (...args: unknown[]) {
        return new (LngLatBoundsMock as unknown as new (...a: unknown[]) => unknown)(...args);
      }),
      NavigationControl: vi.fn().mockImplementation(function (...args: unknown[]) {
        return new (NavigationControlMock as unknown as new (...a: unknown[]) => unknown)(...args);
      }),
      FullscreenControl: vi.fn().mockImplementation(function (...args: unknown[]) {
        return new (FullscreenControlMock as unknown as new (...a: unknown[]) => unknown)(...args);
      }),
      AttributionControl: vi.fn().mockImplementation(function () {}),
    },
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

// Renders CreateIssueModal with a real (isolated) IssuesStore + open modal
function renderModal() {
  const store = createIssuesStore([]);

  render(
    <IssuesStoreContext.Provider value={store}>
      <CreateIssueModal />
    </IssuesStoreContext.Provider>,
  );

  return { store };
}

// Wrapper for act()-protected renders used with external JSX
function renderWithProviders(ui: ReactNode) {
  const store = createIssuesStore([]);
  render(<IssuesStoreContext.Provider value={store}>{ui}</IssuesStoreContext.Provider>);
  return { store };
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  // Open the create-issue modal so CreateIssueModal renders
  useModalStore.setState({ activeModal: 'create-issue' });
});

afterEach(() => {
  useModalStore.setState({ activeModal: null });
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CreateIssueModal — flujo de creación completo', () => {
  it('renderiza el modal con el título "Crear Incidencia"', () => {
    renderModal();
    expect(screen.getByRole('heading', { name: 'Crear Incidencia' })).toBeInTheDocument();
  });

  it('cierra el modal al presionar el botón X', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar modal' }));
    expect(useModalStore.getState().activeModal).toBeNull();
  });

  it('cierra el modal al presionar Escape', () => {
    renderModal();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(useModalStore.getState().activeModal).toBeNull();
  });

  it('no cierra el modal al enviar sin campos obligatorios', async () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));
    await waitFor(() => {
      expect(useModalStore.getState().activeModal).toBe('create-issue');
    });
  });

  it('muestra error en "Título" cuando se intenta enviar vacío', async () => {
    renderModal();
    // Leave title empty, fill everything else
    fireEvent.change(screen.getByLabelText(/descripción/i), {
      target: { value: 'Descripción válida para la prueba' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));
    await waitFor(() => {
      expect(screen.getByText('El título es obligatorio')).toBeInTheDocument();
    });
  });

  it('crea una incidencia y cierra el modal al enviar con todos los campos obligatorios', async () => {
    const { store } = renderModal();

    // Fill required fields
    fireEvent.change(screen.getByLabelText(/título/i), {
      target: { value: 'Fisura en muro sur' },
    });
    fireEvent.change(screen.getByLabelText(/descripción/i), {
      target: { value: 'Fisura horizontal visible de aproximadamente 30 cm.' },
    });
    fireEvent.change(screen.getByLabelText(/fecha de vencimiento/i), {
      target: { value: tomorrow() },
    });
    fireEvent.change(screen.getByLabelText(/categoría/i), {
      target: { value: 'e05995817a9a9bf5c0298f7d' }, // Hidrosanitario
    });
    // Priority already defaults to "media"

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Crear' }));
    });

    await waitFor(() => {
      // Modal must be closed
      expect(useModalStore.getState().activeModal).toBeNull();
      // Store must have the new incident
      const incidents = store.getState().incidents;
      expect(incidents).toHaveLength(1);
      expect(incidents[0].title).toBe('Fisura en muro sur');
      expect(incidents[0].status).toBe('open');
    });
  });

  it('la nueva incidencia tiene prioridad y tipo correctos', async () => {
    const { store } = renderModal();

    fireEvent.change(screen.getByLabelText(/título/i), {
      target: { value: 'Cable expuesto en tablero' },
    });
    fireEvent.change(screen.getByLabelText(/descripción/i), {
      target: { value: 'Cable de 220V sin aislante en tablero eléctrico del piso 2.' },
    });
    fireEvent.change(screen.getByLabelText(/fecha de vencimiento/i), {
      target: { value: tomorrow() },
    });
    fireEvent.change(screen.getByLabelText(/categoría/i), {
      target: { value: '074cf498175293d292634177' }, // Eléctrico
    });
    fireEvent.change(screen.getByLabelText(/prioridad/i), {
      target: { value: 'high' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Crear' }));
    });

    await waitFor(() => {
      const inc = store.getState().incidents[0];
      expect(inc.priority).toBe('high');
      expect(inc.type.key).toBe('electrical');
    });
  });
});

describe('CreateIssueModal — estado del modal', () => {
  it('no renderiza nada cuando activeModal no es create-issue', () => {
    useModalStore.setState({ activeModal: null });
    const { store } = renderWithProviders(<CreateIssueModal />);
    expect(store).toBeDefined();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
