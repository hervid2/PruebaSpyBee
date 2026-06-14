'use client';
import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';

export interface UseMapboxOptions {
  center?: [number, number];
  zoom?: number;
  style?: string;
}

export function useMapbox(
  containerRef: React.RefObject<HTMLDivElement | null>,
  token: string,
  options: UseMapboxOptions = {},
) {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !token) return;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: options.style ?? 'mapbox://styles/mapbox/streets-v12',
      center: options.center ?? [-74.072092, 4.710989], // Bogotá por defecto
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
