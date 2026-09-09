'use client';
/**
 * `/calendario` content: full-page month view of incident activity — an
 * expanded counterpart to the compact `CalendarActivity` dashboard widget.
 * Same day-bucketing convention (by `createdAt`) but scoped to the whole
 * incident collection (this page has no dashboard-style filters), every day
 * is selectable (not just ones with activity), the day-detail list is never
 * clipped, and each incident opens the shared detail modal on click.
 */
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { useIssuesStore } from '@/store/useIssuesStore';
import { useIncidentDetailStore } from '@/store/useIncidentDetailStore';
import styles from './CalendarioView.module.scss';

/** Maps a daily count to a heat-intensity CSS class (none/low/mid/high). */
function getIntensity(count: number): string {
  if (count === 0) return '';
  if (count <= 2) return styles['day--low'];
  if (count <= 5) return styles['day--mid'];
  return styles['day--high'];
}

export default function CalendarioView() {
  const t = useTranslations('calendario');
  const incidents = useIssuesStore((s) => s.incidents);
  const openDetail = useIncidentDetailStore((s) => s.openDetail);
  const [current, setCurrent] = useState(() => new Date());
  // Lazy initializer so "today" is read at first render, not module import —
  // matters for tests that mock the system clock before rendering.
  const [selectedDate, setSelectedDate] = useState<string | null>(() =>
    format(new Date(), 'yyyy-MM-dd'),
  );
  const todayKey = format(new Date(), 'yyyy-MM-dd');

  const DAY_NAMES = [
    t('daySun'),
    t('dayMon'),
    t('dayTue'),
    t('dayWed'),
    t('dayThu'),
    t('dayFri'),
    t('daySat'),
  ];

  const PRIORITY_LABELS: Record<string, string> = {
    high: t('priorityHigh'),
    medium: t('priorityMedium'),
    low: t('priorityLow'),
  };
  const STATUS_LABELS: Record<string, string> = {
    open: t('statusOpen'),
    on_pause: t('statusOnPause'),
    closed: t('statusClosed'),
  };

  // Daily tally across the whole collection, mirroring
  // dashboard-metrics.selector's calendarActivity bucketing — unfiltered,
  // since this page has no dashboard-style filter bar.
  const activityByDay = useMemo(() => {
    const map = new Map<string, number>();
    incidents.forEach((i) => {
      try {
        const key = format(parseISO(i.createdAt), 'yyyy-MM-dd');
        map.set(key, (map.get(key) ?? 0) + 1);
      } catch {
        // malformed date on the incident — skip it, don't break the grid
      }
    });
    return map;
  }, [incidents]);

  const start = startOfMonth(current);
  const end = endOfMonth(current);
  const days = eachDayOfInterval({ start, end });
  const startOffset = getDay(start);

  const goPrev = () => setCurrent((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const goNext = () => setCurrent((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const goToday = () => {
    const now = new Date();
    setCurrent(now);
    setSelectedDate(format(now, 'yyyy-MM-dd'));
  };

  function handleDayClick(key: string) {
    setSelectedDate((prev) => (prev === key ? null : key));
  }

  const selectedIncidents = useMemo(() => {
    if (selectedDate == null) return [];
    return incidents
      .filter((i) => {
        try {
          return format(parseISO(i.createdAt), 'yyyy-MM-dd') === selectedDate;
        } catch {
          return false;
        }
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [incidents, selectedDate]);

  const selectedDateLabel =
    selectedDate != null
      ? format(parseISO(selectedDate), "EEEE d 'de' MMMM yyyy", { locale: es })
      : '';

  return (
    <section className={styles.section} aria-label={t('sectionAriaLabel')}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.header__title}>{t('pageTitle')}</h1>
          <p className={styles.header__subtitle}>{t('pageSubtitle')}</p>
        </div>
        <button type="button" className={styles.todayBtn} onClick={goToday}>
          <CalendarDays size={14} aria-hidden="true" />
          {t('todayAction')}
        </button>
      </div>

      <div className={styles.body}>
        <div className={styles.calendar} aria-label={t('calendarMainAriaLabel')}>
          <div className={styles.nav}>
            <button
              onClick={goPrev}
              aria-label={t('prevMonthAriaLabel')}
              type="button"
              className={styles.nav__btn}
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <span className={styles.nav__month}>
              {format(current, 'MMMM yyyy', { locale: es })}
            </span>
            <button
              onClick={goNext}
              aria-label={t('nextMonthAriaLabel')}
              type="button"
              className={styles.nav__btn}
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>

          {/*
            `role="group"`, not `role="grid"` (F9.7). The ARIA grid pattern
            requires grid > row > gridcell, and this is a CSS grid with the
            cells as direct children, which axe flagged as two critical
            violations. Adding row wrappers would have silenced it and left
            the worse half of the problem: `grid` also promises two-dimensional
            arrow-key navigation (WAI-ARIA APG), and every day here is a plain
            tab stop. The role was describing a widget this is not.

            Nothing is lost by dropping it, because the information was never
            coming from the structure: each day button carries its own full
            accessible name ("9 de septiembre: 0 incidencias"). The weekday
            letters are decorative for the same reason -- without a real
            row/column relationship they cannot be associated with a cell
            anyway, and the date is already spoken in full.
          */}
          <div className={styles.grid} role="group" aria-label={t('daysOfMonthAriaLabel')}>
            {DAY_NAMES.map((d) => (
              <div key={d} className={styles.colHeader} aria-hidden="true">
                {d}
              </div>
            ))}

            {Array.from({ length: startOffset }).map((_, i) => (
              <div key={`empty-${i}`} className={styles.empty} aria-hidden="true" />
            ))}

            {days.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              const count = activityByDay.get(key) ?? 0;
              const isToday = key === todayKey;
              const isSelected = selectedDate === key;
              return (
                <button
                  key={key}
                  type="button"
                  className={[
                    styles.day,
                    getIntensity(count),
                    isToday ? styles['day--today'] : '',
                    isSelected ? styles['day--selected'] : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-label={`${format(day, "d 'de' MMMM", { locale: es })}: ${t('incidentsCount', { count })}${isSelected ? t('selectedSuffix') : ''}`}
                  // `aria-pressed`, not `aria-selected`: the latter is only
                  // valid on roles this button no longer claims.
                  aria-pressed={isSelected}
                  onClick={() => handleDayClick(key)}
                >
                  <span className={styles.day__num}>{day.getDate()}</span>
                  {count > 0 && (
                    <span className={styles.day__badge} aria-hidden="true">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className={styles.legend} aria-label={t('legendAriaLabel')}>
            <span className={styles.legend__label}>{t('legendLess')}</span>
            {['', styles['day--low'], styles['day--mid'], styles['day--high']].map((cls, i) => (
              <span key={i} className={`${styles.legend__dot} ${cls}`} aria-hidden="true" />
            ))}
            <span className={styles.legend__label}>{t('legendMore')}</span>
          </div>
        </div>

        <aside
          className={styles.dayDetail}
          aria-label={t('dayDetailAriaLabel', { date: selectedDateLabel || '' })}
        >
          {selectedDate == null ? (
            <p className={styles.dayDetail__hint}>{t('clickHint')}</p>
          ) : (
            <>
              <div className={styles.dayDetail__header}>
                <span className={styles.dayDetail__date}>{selectedDateLabel}</span>
                <span className={styles.dayDetail__count}>
                  {t('incidentsCount', { count: selectedIncidents.length })}
                </span>
              </div>

              {selectedIncidents.length === 0 ? (
                <p className={styles.dayDetail__empty}>{t('noIncidentsForDay')}</p>
              ) : (
                <ul className={styles.dayDetail__list}>
                  {selectedIncidents.map((i) => (
                    <li key={i.id}>
                      <button
                        type="button"
                        className={styles.dayDetail__item}
                        onClick={() => openDetail(i.id)}
                        aria-label={t('viewIncidentAriaLabel', { title: i.title })}
                      >
                        <span className={styles.dayDetail__id}>#{i.sequenceId}</span>
                        <span className={styles.dayDetail__title}>{i.title}</span>
                        <span
                          className={`${styles.badge} ${styles[`badge--priority-${i.priority}`]}`}
                        >
                          {PRIORITY_LABELS[i.priority]}
                        </span>
                        <span className={`${styles.badge} ${styles[`badge--status-${i.status}`]}`}>
                          {STATUS_LABELS[i.status]}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
