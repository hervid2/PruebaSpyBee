'use client';
import { PanelLeft, Filter } from 'lucide-react';
import { format, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import { useFiltersStore } from '@/store/useFiltersStore';
import styles from './MapFilterBar.module.scss';

const VISIT_STOPS = [1, 2, 3, 4, 5];

function formatDisplayDate(isoDate: string): string {
  try {
    return format(parse(isoDate, 'yyyy-MM-dd', new Date()), 'dd MMM yyyy', { locale: es });
  } catch {
    return isoDate;
  }
}

export default function MapFilterBar() {
  const date = useFiltersStore((s) => s.mapFilters.date);
  const lastVisits = useFiltersStore((s) => s.mapFilters.lastVisits);
  const setMapDate = useFiltersStore((s) => s.setMapDate);
  const setLastVisits = useFiltersStore((s) => s.setLastVisits);

  return (
    <div className={styles['map-filter-bar']} role="toolbar" aria-label="Filtros de mapa">
      <div className={styles['map-filter-bar__left']}>
        <button
          className={styles['map-filter-bar__icon-btn']}
          type="button"
          aria-label="Ver detalles del panel"
        >
          <PanelLeft size={15} />
          <span className={styles['map-filter-bar__btn-label']}>Ver detalles</span>
        </button>

        <span className={styles['map-filter-bar__divider']} aria-hidden="true" />

        <button
          className={styles['map-filter-bar__icon-btn']}
          type="button"
          aria-label="Abrir filtros"
        >
          <Filter size={15} />
        </button>

        <label className={styles['map-filter-bar__date-wrapper']}>
          <span className={styles['map-filter-bar__visually-hidden']}>Seleccionar fecha</span>
          <span className={styles['map-filter-bar__date-display']}>{formatDisplayDate(date)}</span>
          <input
            type="date"
            className={styles['map-filter-bar__date-input']}
            value={date}
            onChange={(e) => setMapDate(e.target.value)}
            aria-label="Fecha del mapa"
          />
        </label>

        <div className={styles['map-filter-bar__slider-section']}>
          <span className={styles['map-filter-bar__slider-label']}>
            Últimas {lastVisits} visita{lastVisits !== 1 ? 's' : ''}
          </span>
          <div className={styles['map-filter-bar__slider-track']}>
            <input
              type="range"
              className={styles['map-filter-bar__slider']}
              min={1}
              max={5}
              step={1}
              value={lastVisits}
              onChange={(e) => setLastVisits(Number(e.target.value))}
              aria-label="Número de últimas visitas"
              aria-valuenow={lastVisits}
              aria-valuemin={1}
              aria-valuemax={5}
            />
            <div className={styles['map-filter-bar__stops']} aria-hidden="true">
              {VISIT_STOPS.map((n) => (
                <span
                  key={n}
                  className={[
                    styles['map-filter-bar__stop'],
                    n <= lastVisits ? styles['map-filter-bar__stop--active'] : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={styles['map-filter-bar__right']}>
        <button className={styles['map-filter-bar__action-btn']} type="button">
          Comparar
        </button>
        <button className={styles['map-filter-bar__action-btn']} type="button">
          Comparar BIM
        </button>
      </div>
    </div>
  );
}
