'use client';
import { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { Incident } from '@/domain/models/incident.model';
import styles from './CalendarActivity.module.scss';

interface CalendarActivityProps {
  activity: { date: string; count: number }[];
  incidents?: Incident[];
  selectedDate?: string | null;
  onSelectDate?: (date: string | null) => void;
}

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const PRIORITY_LABELS: Record<string, string> = { high: 'Alta', medium: 'Media', low: 'Baja' };
const STATUS_LABELS: Record<string, string> = {
  open: 'Abierta',
  on_pause: 'Pausada',
  closed: 'Cerrada',
};

function getIntensity(count: number): string {
  if (count === 0) return '';
  if (count <= 2) return styles['calendar__day--low'];
  if (count <= 5) return styles['calendar__day--mid'];
  return styles['calendar__day--high'];
}

export default function CalendarActivity({
  activity,
  incidents = [],
  selectedDate: controlledDate,
  onSelectDate,
}: CalendarActivityProps) {
  const [current, setCurrent] = useState(() => new Date());
  const [internalDate, setInternalDate] = useState<string | null>(null);

  const selectedDate = controlledDate !== undefined ? controlledDate : internalDate;

  function setSelectedDate(val: string | null) {
    if (onSelectDate) {
      onSelectDate(val);
    } else {
      setInternalDate(val);
    }
  }

  const actMap = new Map(activity.map((a) => [a.date, a.count]));

  const start = startOfMonth(current);
  const end = endOfMonth(current);
  const days = eachDayOfInterval({ start, end });
  const startOffset = getDay(start);

  const prev = () => setCurrent((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const next = () => setCurrent((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const selectedIncidents =
    selectedDate != null
      ? incidents.filter((i) => {
          try {
            return format(parseISO(i.createdAt), 'yyyy-MM-dd') === selectedDate;
          } catch {
            return false;
          }
        })
      : [];

  const selectedDateLabel =
    selectedDate != null ? format(parseISO(selectedDate), "d 'de' MMMM yyyy", { locale: es }) : '';

  function handleDayClick(key: string, count: number) {
    if (count === 0) return;
    setSelectedDate(selectedDate === key ? null : key);
  }

  return (
    <div className={styles.calendar} aria-label="Historial de actividad mensual">
      <div className={styles.calendar__nav}>
        <button
          onClick={prev}
          aria-label="Mes anterior"
          type="button"
          className={styles.calendar__nav_btn}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <span className={styles.calendar__month}>
          {format(current, 'MMMM yyyy', { locale: es })}
        </span>
        <button
          onClick={next}
          aria-label="Mes siguiente"
          type="button"
          className={styles.calendar__nav_btn}
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>

      <div className={styles.calendar__grid} role="grid" aria-label="Días del mes">
        {DAY_NAMES.map((d) => (
          <div key={d} className={styles.calendar__col_header} role="columnheader" aria-label={d}>
            {d}
          </div>
        ))}

        {Array.from({ length: startOffset }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className={styles.calendar__empty}
            role="gridcell"
            aria-hidden="true"
          />
        ))}

        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const count = actMap.get(key) ?? 0;
          const isToday = key === format(new Date(), 'yyyy-MM-dd');
          const isSelected = selectedDate === key;
          const isClickable = count > 0;
          return (
            <div
              key={key}
              className={[
                styles.calendar__day,
                getIntensity(count),
                isToday ? styles['calendar__day--today'] : '',
                isSelected ? styles['calendar__day--selected'] : '',
                isClickable ? styles['calendar__day--clickable'] : '',
              ]
                .filter(Boolean)
                .join(' ')}
              role="gridcell"
              aria-label={`${format(day, "d 'de' MMMM", { locale: es })}: ${count} incidencia${count !== 1 ? 's' : ''}${isSelected ? ', seleccionado' : ''}`}
              aria-selected={isSelected}
              onClick={() => handleDayClick(key, count)}
            >
              <span className={styles.calendar__day_num}>{day.getDate()}</span>
              {count > 0 && (
                <span className={styles.calendar__badge} aria-hidden="true">
                  {count}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.calendar__legend} aria-label="Leyenda de intensidad">
        <span className={styles.calendar__legend_label}>Menos</span>
        {[
          '',
          styles['calendar__day--low'],
          styles['calendar__day--mid'],
          styles['calendar__day--high'],
        ].map((cls, i) => (
          <span key={i} className={`${styles.calendar__legend_dot} ${cls}`} aria-hidden="true" />
        ))}
        <span className={styles.calendar__legend_label}>Más</span>
      </div>

      <p className={styles.calendar__hint}>Haz clic en un día con actividad para ver el detalle</p>

      {selectedDate != null && (
        <div
          className={styles.dayDetail}
          aria-label={`Detalle de incidencias del ${selectedDateLabel}`}
        >
          <div className={styles.dayDetail__header}>
            <span className={styles.dayDetail__date}>{selectedDateLabel}</span>
            <span className={styles.dayDetail__count}>
              {selectedIncidents.length} incidencia{selectedIncidents.length !== 1 ? 's' : ''}
            </span>
            <button
              className={styles.dayDetail__close}
              onClick={() => setSelectedDate(null)}
              aria-label="Cerrar detalle"
            >
              <X size={12} />
            </button>
          </div>

          {selectedIncidents.length === 0 ? (
            <p className={styles.dayDetail__empty}>
              Sin incidencias para este día en el filtro actual.
            </p>
          ) : (
            <ul className={styles.dayDetail__list}>
              {selectedIncidents.slice(0, 8).map((i) => (
                <li key={i.id} className={styles.dayDetail__item}>
                  <span className={styles.dayDetail__id}>#{i.sequenceId}</span>
                  <span className={styles.dayDetail__title}>{i.title}</span>
                  <span
                    className={`${styles.dayDetail__priority} ${styles[`dayDetail__priority--${i.priority}`]}`}
                  >
                    {PRIORITY_LABELS[i.priority]}
                  </span>
                  <span
                    className={`${styles.dayDetail__status} ${styles[`dayDetail__status--${i.status}`]}`}
                  >
                    {STATUS_LABELS[i.status]}
                  </span>
                </li>
              ))}
              {selectedIncidents.length > 8 && (
                <li className={styles.dayDetail__more}>+{selectedIncidents.length - 8} más</li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
