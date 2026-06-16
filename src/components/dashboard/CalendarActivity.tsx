'use client';
import { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './CalendarActivity.module.scss';

interface CalendarActivityProps {
  activity: { date: string; count: number }[];
}

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function getIntensity(count: number): string {
  if (count === 0) return '';
  if (count <= 2) return styles['calendar__day--low'];
  if (count <= 5) return styles['calendar__day--mid'];
  return styles['calendar__day--high'];
}

export default function CalendarActivity({ activity }: CalendarActivityProps) {
  const [current, setCurrent] = useState(() => new Date());

  const actMap = new Map(activity.map((a) => [a.date, a.count]));

  const start = startOfMonth(current);
  const end = endOfMonth(current);
  const days = eachDayOfInterval({ start, end });
  const startOffset = getDay(start);

  const prev = () => setCurrent((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const next = () => setCurrent((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

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
          return (
            <div
              key={key}
              className={`${styles.calendar__day} ${getIntensity(count)} ${isToday ? styles['calendar__day--today'] : ''}`}
              role="gridcell"
              aria-label={`${format(day, "d 'de' MMMM", { locale: es })}: ${count} incidencia${count !== 1 ? 's' : ''}`}
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
    </div>
  );
}
