'use client';
/**
 * Geo + temporal panel of the dashboard. Renders a Mapbox heatmap of incident
 * density alongside the {@link CalendarActivity} grid; selecting a day swaps the
 * heatmap for that day's individual markers, linking the two views.
 */
import { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { format, parseISO } from 'date-fns';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { useIssuesStore } from '@/store/useIssuesStore';
import { createMarkerElement } from '@/components/map/IncidentMarker';
import { getPopupHTML } from '@/components/map/IncidentPopup';
import CalendarActivity from './CalendarActivity';
import styles from './HeatmapSection.module.scss';

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

export default function HeatmapSection() {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const metrics = useDashboardMetrics();
  const incidents = useIssuesStore((s) => s.incidents);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Map initialization — runs once.
  useEffect(() => {
    // Without a token, mapbox-gl fails to load the style (401) and retries in a
    // loop, saturating software WebGL in CI. Like useMapbox, skip init entirely.
    if (!containerRef.current || mapRef.current || !TOKEN) return;

    mapboxgl.accessToken = TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-74.072, 4.711],
      zoom: 9,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new mapboxgl.AttributionControl({ compact: true }));

    map.on('load', () => {
      const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: metrics.heatmapPoints.map((p) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
          properties: { weight: p.weight },
        })),
      };

      map.addSource('incidents-heat', { type: 'geojson', data: geojson });

      map.addLayer({
        id: 'incidents-heat-layer',
        type: 'heatmap',
        source: 'incidents-heat',
        paint: {
          'heatmap-weight': ['get', 'weight'],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 9, 3],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(33,102,172,0)',
            0.2,
            'rgba(103,169,207,0.6)',
            0.4,
            'rgba(209,229,240,0.8)',
            0.6,
            'rgba(253,219,199,0.9)',
            0.8,
            'rgba(239,138,98,1)',
            1,
            'rgba(178,24,43,1)',
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 9, 20],
          'heatmap-opacity': 0.85,
        },
      });

      setIsLoaded(true);
    });

    mapRef.current = map;

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      setIsLoaded(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync markers + heatmap visibility whenever incidents/selectedDate change.
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const toShow = selectedDate
      ? incidents.filter((i) => {
          try {
            return format(parseISO(i.createdAt), 'yyyy-MM-dd') === selectedDate;
          } catch {
            return false;
          }
        })
      : incidents;

    toShow
      .filter((i) => i.coordinates != null)
      .forEach((incident) => {
        const el = createMarkerElement(incident);
        const popup = new mapboxgl.Popup({
          closeButton: true,
          closeOnClick: false,
          maxWidth: '280px',
          offset: 20,
        }).setHTML(getPopupHTML(incident));

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([incident.coordinates!.lng, incident.coordinates!.lat])
          .setPopup(popup)
          .addTo(mapRef.current!);

        markersRef.current.push(marker);
      });

    // When a date is selected show only its markers; otherwise also show heatmap density
    if (mapRef.current.getLayer('incidents-heat-layer')) {
      mapRef.current.setLayoutProperty(
        'incidents-heat-layer',
        'visibility',
        selectedDate ? 'none' : 'visible',
      );
    }
  }, [incidents, selectedDate, isLoaded]);

  return (
    <section className={styles.heatmap} aria-labelledby="heatmap-title">
      <h2 id="heatmap-title" className={styles.heatmap__title}>
        Mapa de incidencias — Distribución geográfica y temporal
      </h2>
      <div className={styles.heatmap__body}>
        <div
          ref={containerRef}
          className={styles.heatmap__map}
          role="img"
          aria-label="Mapa de incidencias"
        >
          {!TOKEN && (
            <p className={styles.heatmap__fallback}>Mapa no disponible (sin token de Mapbox).</p>
          )}
        </div>
        <aside className={styles.heatmap__calendar} aria-label="Actividad por día">
          <h3 className={styles.heatmap__calendar_title}>Actividad diaria</h3>
          <CalendarActivity
            activity={metrics.calendarActivity}
            incidents={incidents}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        </aside>
      </div>
    </section>
  );
}
