'use client';
import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';

/** Optional initial camera/style overrides for {@link useMapbox}. */
export interface UseMapboxOptions {
  center?: [number, number];
  zoom?: number;
  style?: string;
}

/**
 * Encapsulates the Mapbox GL lifecycle: creates the map once the container and
 * token are ready, exposes the instance via a ref, and tears it down on
 * unmount. Centralizing this keeps map components declarative and leak-free.
 *
 * @param containerRef Element the canvas mounts into.
 * @param token        Mapbox access token; the effect no-ops while empty (e.g. in CI).
 * @returns `mapRef` (the live map) and `isLoaded` (true after the load event).
 */
export function useMapbox(
  containerRef: React.RefObject<HTMLDivElement | null>,
  token: string,
  options: UseMapboxOptions = {},
) {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Guard: skip until the container and token exist, and never re-create.
    if (!containerRef.current || mapRef.current || !token) return;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: options.style ?? 'mapbox://styles/mapbox/streets-v12',
      center: options.center ?? [-74.072092, 4.710989], // Bogotá by default
      zoom: options.zoom ?? 12,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left');
    map.on('load', () => setIsLoaded(true));

    mapRef.current = map;

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { mapRef, isLoaded };
}
