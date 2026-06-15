'use client';
import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
import { formatDistanceToNow, parseISO, isBefore, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { useIssuesStore } from '@/store/useIssuesStore';
import { useFiltersStore } from '@/store/useFiltersStore';
import type { Incident } from '@/domain/models/incident.model';
import type { RiskFilter } from './RiskIndicators';
import styles from './CriticalIssuesList.module.scss';

const PAGE_SIZE = 10;
const TODAY = startOfDay(new Date());

const PRIORITY_LABELS: Record<string, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Abierta',
  on_pause: 'Pausada',
  closed: 'Cerrada',
};

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

function dueDateText(dueDate: string | null): string {
  if (!dueDate) return '—';
  const due = parseISO(dueDate);
  const isOverdue = isBefore(due, TODAY);
  const distance = formatDistanceToNow(due, { locale: es, addSuffix: true });
  return isOverdue ? `Vencida ${distance}` : `Vence ${distance}`;
}

interface Props {
  riskFilter: RiskFilter;
}

export default function CriticalIssuesList({ riskFilter }: Props) {
  const incidents = useIssuesStore((s) => s.incidents);
  const dashboardFilters = useFiltersStore((s) => s.dashboardFilters);
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<'priority' | 'dueDate'>('priority');

  const { filtered } = useMemo(() => {
    let list = incidents.filter((i) => {
      if (dashboardFilters.status?.length && !dashboardFilters.status.includes(i.status))
        return false;
      if (dashboardFilters.priority?.length && !dashboardFilters.priority.includes(i.priority))
        return false;
      if (dashboardFilters.typeKey?.length && !dashboardFilters.typeKey.includes(i.type.key))
        return false;
      if (
        dashboardFilters.createdByUser?.length &&
        !dashboardFilters.createdByUser.includes(i.owner.id)
      )
        return false;
      if (
        dashboardFilters.responsibleUser?.length &&
        !(i.assignees ?? [])
          .filter(Boolean)
          .some((a) => dashboardFilters.responsibleUser!.includes(a.id))
      )
        return false;
      return true;
    });

    if (riskFilter === 'overdueToday') {
      list = list.filter(
        (i) => i.status === 'open' && i.dueDate && isBefore(parseISO(i.dueDate), TODAY),
      );
    } else if (riskFilter === 'staleSince7d') {
      const sevenAgo = new Date(TODAY);
      sevenAgo.setDate(sevenAgo.getDate() - 7);
      list = list.filter((i) => i.status === 'open' && isBefore(parseISO(i.updatedAt), sevenAgo));
    } else if (riskFilter === 'highPriorityOpen') {
      list = list.filter((i) => i.status === 'open' && i.priority === 'high');
    } else if (riskFilter === 'dueWithin7d') {
      const sevenFwd = new Date(TODAY);
      sevenFwd.setDate(sevenFwd.getDate() + 7);
      list = list.filter(
        (i) =>
          i.status === 'open' &&
          i.dueDate &&
          !isBefore(parseISO(i.dueDate), TODAY) &&
          isBefore(parseISO(i.dueDate), sevenFwd),
      );
    }

    if (sortField === 'priority') {
      list = [...list].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
    } else {
      list = [...list].sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
    }

    return { filtered: list };
  }, [incidents, dashboardFilters, riskFilter, sortField]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems: Incident[] = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleSort(field: 'priority' | 'dueDate') {
    setSortField(field);
    setPage(1);
  }

  return (
    <section className={styles.section} aria-label="Lista de incidencias">
      <div className={styles.header}>
        <h2 className={styles.header__title}>
          Incidencias
          {riskFilter && <span className={styles.header__badge}> (filtrado por riesgo)</span>}
        </h2>
        <p className={styles.header__count}>
          {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} de{' '}
          {filtered.length}
        </p>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>ID</th>
              <th className={styles.th}>Título</th>
              <th
                className={`${styles.th} ${styles['th--sortable']}`}
                onClick={() => handleSort('priority')}
              >
                Prioridad <ArrowUpDown size={12} aria-hidden />
              </th>
              <th className={styles.th}>Estado</th>
              <th className={styles.th}>Asignados</th>
              <th
                className={`${styles.th} ${styles['th--sortable']}`}
                onClick={() => handleSort('dueDate')}
              >
                Vencimiento <ArrowUpDown size={12} aria-hidden />
              </th>
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.empty}>
                  No hay incidencias para mostrar.
                </td>
              </tr>
            ) : (
              pageItems.map((incident) => {
                const overdue =
                  incident.status === 'open' &&
                  incident.dueDate &&
                  isBefore(parseISO(incident.dueDate), TODAY);
                return (
                  <tr key={incident.id} className={styles.row}>
                    <td className={styles.td}>
                      <span className={styles.id}>#{incident.sequenceId}</span>
                    </td>
                    <td className={styles.td}>
                      <span className={styles.title}>{incident.title}</span>
                    </td>
                    <td className={styles.td}>
                      <span
                        className={`${styles.priority} ${styles[`priority--${incident.priority}`]}`}
                      >
                        {PRIORITY_LABELS[incident.priority]}
                      </span>
                    </td>
                    <td className={styles.td}>
                      <span className={`${styles.status} ${styles[`status--${incident.status}`]}`}>
                        {STATUS_LABELS[incident.status]}
                      </span>
                    </td>
                    <td className={styles.td}>
                      <div className={styles.avatars}>
                        {incident.assignees.slice(0, 3).map((a) => (
                          <span key={a.id} className={styles.avatar} title={a.name}>
                            {a.name.charAt(0).toUpperCase()}
                          </span>
                        ))}
                        {incident.assignees.length > 3 && (
                          <span className={styles.avatarMore}>
                            +{incident.assignees.length - 3}
                          </span>
                        )}
                        {incident.assignees.length === 0 && (
                          <span className={styles.noAssignee}>—</span>
                        )}
                      </div>
                    </td>
                    <td className={`${styles.td} ${overdue ? styles['td--overdue'] : ''}`}>
                      {dueDateText(incident.dueDate)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.pagination} role="navigation" aria-label="Paginación">
        <button
          className={styles.pagination__btn}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          aria-label="Página anterior"
        >
          <ChevronLeft size={16} />
        </button>
        <span className={styles.pagination__info}>
          {page} / {totalPages}
        </span>
        <button
          className={styles.pagination__btn}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          aria-label="Página siguiente"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </section>
  );
}
