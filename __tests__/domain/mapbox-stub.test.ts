/**
 * Provides and verifies a lightweight mapbox-gl mock. mapbox-gl needs WebGL,
 * which jsdom lacks, so this stub stands in for the real library: the test
 * confirms the mocked Map/Marker/Popup chainable API behaves as components expect.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

  function AttributionControlMock(this: Record<string, unknown>) {
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
      AttributionControl: vi.fn().mockImplementation(function (...args: unknown[]) {
        return new (AttributionControlMock as unknown as new (...a: unknown[]) => unknown)(...args);
      }),
    },
  };
});

describe('mapbox-gl stub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('crea una instancia de Map sin lanzar errores', async () => {
    const mapboxgl = (await import('mapbox-gl')).default;
    mapboxgl.accessToken = 'pk.test_token';
    const container = document.createElement('div');
    const map = new mapboxgl.Map({
      container,
      style: 'mapbox://styles/mapbox/streets-v12',
    } as never);
    expect(map).toBeDefined();
    expect((map as unknown as Record<string, unknown>).on).toBeDefined();
  });

  it('Marker encadena setLngLat → addTo y puede eliminarse', async () => {
    const mapboxgl = (await import('mapbox-gl')).default;
    const map = new mapboxgl.Map({} as never);
    const marker = new mapboxgl.Marker().setLngLat([-74.07, 4.71]).addTo(map);
    expect((marker as unknown as Record<string, unknown>).remove).toBeDefined();
    (marker as unknown as { remove: () => void }).remove();
    expect((marker as unknown as Record<string, unknown>).remove).toHaveBeenCalledOnce();
  });

  it('Popup.setHTML retorna self para encadenamiento', async () => {
    const mapboxgl = (await import('mapbox-gl')).default;
    const popup = new mapboxgl.Popup();
    const result = popup.setHTML('<div>contenido de prueba</div>');
    expect(result).toBe(popup);
  });

  it('Map.setProjection es llamable con "globe" y "mercator"', async () => {
    const mapboxgl = (await import('mapbox-gl')).default;
    const map = new mapboxgl.Map({} as never);
    const setProjection = (map as unknown as Record<string, unknown>).setProjection as (
      p: string,
    ) => void;
    expect(() => setProjection('globe')).not.toThrow();
    expect(() => setProjection('mercator')).not.toThrow();
  });

  it('LngLatBounds.extend retorna self para encadenamiento', async () => {
    const mapboxgl = (await import('mapbox-gl')).default;
    const sw: [number, number] = [-74.1, 4.6];
    const ne: [number, number] = [-74.0, 4.8];
    const bounds = new mapboxgl.LngLatBounds(sw, ne);
    const result = (bounds as { extend: (c: unknown) => unknown }).extend([-74.05, 4.71]);
    expect(result).toBe(bounds);
  });

  it('Map.flyTo es llamable con un centro y zoom', async () => {
    const mapboxgl = (await import('mapbox-gl')).default;
    const map = new mapboxgl.Map({} as never);
    const flyTo = (map as unknown as Record<string, unknown>).flyTo as (o: unknown) => void;
    expect(() => flyTo({ center: [-74.07, 4.71], zoom: 14 })).not.toThrow();
  });
});
