'use client';
import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { Coordinates } from '@/domain/models';
import styles from './LocationPicker.module.scss';

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

// Default center: Bogotá, Colombia
const DEFAULT_CENTER: [number, number] = [-74.0721, 4.711];

interface Props {
  value: Coordinates | null;
  locationDescription: string | null;
  onChangeCoords: (coords: Coordinates | null) => void;
  onChangeDescription: (description: string | null) => void;
}

export default function LocationPicker({
  value,
  locationDescription,
  onChangeCoords,
  onChangeDescription,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  // Keep stable refs to callbacks so the map event listeners never go stale
  const onChangeCoordsRef = useRef(onChangeCoords);
  useEffect(() => {
    onChangeCoordsRef.current = onChangeCoords;
  }, [onChangeCoords]);

  const [latInput, setLatInput] = useState(value != null ? String(value.lat) : '');
  const [lngInput, setLngInput] = useState(value != null ? String(value.lng) : '');

  // Expose placeMarker so handlers outside the effect can call it
  const placeMarkerRef = useRef<((coords: Coordinates) => void) | null>(null);

  useEffect(() => {
    // Sin token, mapbox-gl falla al cargar el estilo (401) y entra en un bucle de
    // reintentos que satura el WebGL en CI. Igual que useMapbox, no inicializamos el mapa.
    if (!containerRef.current || mapRef.current || !TOKEN) return;

    mapboxgl.accessToken = TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: value ? [value.lng, value.lat] : DEFAULT_CENTER,
      zoom: value ? 14 : 10,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.addControl(new mapboxgl.FullscreenControl(), 'top-right');

    function placeMarker(coords: Coordinates) {
      markerRef.current?.remove();

      const marker = new mapboxgl.Marker({ color: '#F2B705', draggable: true })
        .setLngLat([coords.lng, coords.lat])
        .addTo(map);

      marker.on('dragend', () => {
        const ll = marker.getLngLat();
        const updated: Coordinates = { lat: ll.lat, lng: ll.lng };
        onChangeCoordsRef.current(updated);
        setLatInput(ll.lat.toFixed(8));
        setLngInput(ll.lng.toFixed(8));
      });

      markerRef.current = marker;
    }

    placeMarkerRef.current = placeMarker;

    map.on('click', (e: mapboxgl.MapMouseEvent) => {
      const { lat, lng } = e.lngLat;
      placeMarker({ lat, lng });
      onChangeCoordsRef.current({ lat, lng });
      setLatInput(lat.toFixed(8));
      setLngInput(lng.toFixed(8));
    });

    mapRef.current = map;

    if (value) {
      placeMarker(value);
    }

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      placeMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyInputCoords(lat: number, lng: number) {
    if (isNaN(lat) || isNaN(lng)) return;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;
    const coords: Coordinates = { lat, lng };
    onChangeCoords(coords);
    if (mapRef.current && placeMarkerRef.current) {
      placeMarkerRef.current(coords);
      mapRef.current.flyTo({ center: [lng, lat], zoom: 14 });
    }
  }

  const handleLatChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLatInput(e.target.value);
    applyInputCoords(parseFloat(e.target.value), parseFloat(lngInput));
  };

  const handleLngChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLngInput(e.target.value);
    applyInputCoords(parseFloat(latInput), parseFloat(e.target.value));
  };

  return (
    <div className={styles.picker}>
      <div
        ref={containerRef}
        className={styles.picker__map}
        role="application"
        aria-label="Mini-mapa de ubicación. Haz clic para fijar la ubicación de la incidencia."
      >
        {!TOKEN && (
          <p className={styles.picker__fallback}>
            Mapa no disponible. Ingresa las coordenadas manualmente.
          </p>
        )}
      </div>

      <div className={styles.picker__coords}>
        <div className={styles.picker__coord_field}>
          <label htmlFor="loc-lat" className={styles.picker__label}>
            Latitud
          </label>
          <input
            id="loc-lat"
            type="number"
            step="any"
            className={styles.picker__coord_input}
            value={latInput}
            onChange={handleLatChange}
            placeholder="0.00000000"
            aria-describedby="loc-lat-hint"
          />
          <span id="loc-lat-hint" className={styles.picker__hint}>
            −90 a 90
          </span>
        </div>

        <div className={styles.picker__coord_field}>
          <label htmlFor="loc-lng" className={styles.picker__label}>
            Longitud
          </label>
          <input
            id="loc-lng"
            type="number"
            step="any"
            className={styles.picker__coord_input}
            value={lngInput}
            onChange={handleLngChange}
            placeholder="0.00000000"
            aria-describedby="loc-lng-hint"
          />
          <span id="loc-lng-hint" className={styles.picker__hint}>
            −180 a 180
          </span>
        </div>
      </div>

      <div className={styles.picker__detail_field}>
        <label htmlFor="loc-detail" className={styles.picker__label}>
          Detalles de localización
        </label>
        <input
          id="loc-detail"
          type="text"
          className={styles.picker__detail_input}
          placeholder="Ej. Piso 3, Sala 301, eje C"
          value={locationDescription ?? ''}
          onChange={(e) => onChangeDescription(e.target.value || null)}
          maxLength={500}
        />
      </div>
    </div>
  );
}
