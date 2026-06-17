'use client';
import { useState, useMemo } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, ArrowUpDown, SlidersHorizontal, X } from 'lucide-react';
import { formatDistanceToNow, parseISO, isBefore, isAfter, startOfDay, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { useIssuesStore } from '@/store/useIssuesStore';
import { useFiltersStore } from '@/store/useFiltersStore';
import { MOCK_USERS } from '@/lib/constants/mock-users';
import type { Incident, IncidentPriority, IncidentStatus } from '@/domain/models/incident.model';
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

type DueFilter = 'all' | 'overdue' | 'dueSoon' | 'noDate';

interface TableFilters {
  priority: IncidentPriority[];
  status: IncidentStatus[];
  createdBy: string[];
  due: DueFilter;
}

const DEFAULT_TABLE_FILTERS: TableFilters = {
  priority: [],
  status: [],
  createdBy: [],
  due: 'all',
};

function toggle<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

function dueDateText(dueDate: string | null): string {
  if (!dueDate) return '—';
  const due = parseISO(dueDate);
  const isOverdue = isBefore(due, TODAY);
  const distance = formatDistanceToNow(due, { locale: es, addSuffix: true });
  return isOverdue ? `Vencida ${distance}` : `Vence ${distance}`;
}

function UserAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  const [imgError, setImgError] = useState(false);
  if (avatarUrl && !imgError) {
    return (
      <span className={styles.avatarWrap} title={name}>
        <Image
          src={avatarUrl}
          alt={name}
          width={28}
          height={22}
          className={styles.avatarImg}
          onError={() => setImgError(true)}
        />
      </span>
    );
  }
  return (
    <span className={styles.avatarWrap} title={name}>
      <span className={styles.avatar}>{name.charAt(0).toUpperCase()}</span>
    </span>
  );
}

function TableFiltersModal({
  filters,
  onChange,
  onClose,
}: {
  filters: TableFilters;
  onChange: (f: TableFilters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<TableFilters>(filters);

  const priorities: { value: IncidentPriority; label: string }[] = [
    { value: 'high', label: 'Alta' },
    { value: 'medium', label: 'Media' },
    { value: 'low', label: 'Baja' },
  ];
  const statuses: { value: IncidentStatus; label: string }[] = [
    { value: 'open', label: 'Abierta' },
    { value: 'on_pause', label: 'Pausada' },
    { value: 'closed', label: 'Cerrada' },
  ];
  const dueOptions: { value: DueFilter; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: 'overdue', label: 'Vencidas' },
    { value: 'dueSoon', label: 'Próximas (7d)' },
    { value: 'noDate', label: 'Sin fecha' },
  ];

  const activeCount =
    draft.priority.length +
    draft.status.length +
    draft.createdBy.length +
    (draft.due !== 'all' ? 1 : 0);

  return (
    <div className={styles.filterOverlay} role="dialog" aria-modal aria-label="Filtrar incidencias">
      <div className={styles.filterModal}>
        <div className={styles.filterModal__header}>
          <h3 className={styles.filterModal__title}>Filtrar incidencias</h3>
          <button
            className={styles.filterModal__close}
            onClick={onClose}
            aria-label="Cerrar filtros"
          >
            <X size={16} />
          </button>
        </div>

        <div className={styles.filterModal__body}>
          <fieldset className={styles.filterField}>
            <legend className={styles.filterField__label}>Prioridad</legend>
            <div className={styles.chipRow}>
              {priorities.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={`${styles.fChip} ${draft.priority.includes(value) ? styles['fChip--active'] : ''}`}
                  onClick={() => setDraft((d) => ({ ...d, priority: toggle(d.priority, value) }))}
                  aria-pressed={draft.priority.includes(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.filterField}>
            <legend className={styles.filterField__label}>Estado</legend>
            <div className={styles.chipRow}>
              {statuses.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={`${styles.fChip} ${draft.status.includes(value) ? styles['fChip--active'] : ''}`}
                  onClick={() => setDraft((d) => ({ ...d, status: toggle(d.status, value) }))}
                  aria-pressed={draft.status.includes(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.filterField}>
            <legend className={styles.filterField__label}>Creado por</legend>
            <div className={styles.userFilterList}>
              {MOCK_USERS.map((u) => {
                const active = draft.createdBy.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    className={`${styles.userFilterChip} ${active ? styles['userFilterChip--active'] : ''}`}
                    onClick={() =>
                      setDraft((d) => ({ ...d, createdBy: toggle(d.createdBy, u.id) }))
                    }
                    aria-pressed={active}
                  >
                    <span className={styles.userFilterChip__avatar}>{u.name.charAt(0)}</span>
                    <span className={styles.userFilterChip__name}>{u.name}</span>
                    <span className={styles.userFilterChip__company}>{u.company}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className={styles.filterField}>
            <legend className={styles.filterField__label}>Vencimiento</legend>
            <div className={styles.chipRow}>
              {dueOptions.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={`${styles.fChip} ${draft.due === value ? styles['fChip--active'] : ''}`}
                  onClick={() => setDraft((d) => ({ ...d, due: value }))}
                  aria-pressed={draft.due === value}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <div className={styles.filterModal__footer}>
          <button
            type="button"
            className={styles.filterBtnSecondary}
            onClick={() => {
              const reset = DEFAULT_TABLE_FILTERS;
              setDraft(reset);
              onChange(reset);
              onClose();
            }}
          >
            Limpiar
          </button>
          <button
            type="button"
            className={styles.filterBtnPrimary}
            onClick={() => {
              onChange(draft);
              onClose();
            }}
          >
            Aplicar{activeCount > 0 && ` (${activeCount})`}
          </button>
        </div>
      </div>
    </div>
  );
}

interface Props {
  riskFilter: RiskFilter;
}

export default function CriticalIssuesList({ riskFilter }: Props) {
  const incidents = useIssuesStore((s) => s.incidents);
  const dashboardFilters = useFiltersStore((s) => s.dashboardFilters);
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<'priority' | 'dueDate'>('priority');
  const [tableFilters, setTableFilters] = useState<TableFilters>(DEFAULT_TABLE_FILTERS);
  const [showFilterModal, setShowFilterModal] = useState(false);

  const activeFilterCount =
    tableFilters.priority.length +
    tableFilters.status.length +
    tableFilters.createdBy.length +
    (tableFilters.due !== 'all' ? 1 : 0);

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
        !dashboardFilters.createdByUser.includes(i.owner?.id ?? '')
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

    // Apply table-level filters
    if (tableFilters.priority.length) {
      list = list.filter((i) => tableFilters.priority.includes(i.priority));
    }
    if (tableFilters.status.length) {
      list = list.filter((i) => tableFilters.status.includes(i.status));
    }
    if (tableFilters.createdBy.length) {
      list = list.filter((i) => tableFilters.createdBy.includes(i.owner?.id ?? ''));
    }
    if (tableFilters.due === 'overdue') {
      list = list.filter((i) => i.dueDate && isBefore(parseISO(i.dueDate), TODAY));
    } else if (tableFilters.due === 'dueSoon') {
      const sevenFwd = addDays(TODAY, 7);
      list = list.filter(
        (i) =>
          i.dueDate &&
          !isBefore(parseISO(i.dueDate), TODAY) &&
          !isAfter(parseISO(i.dueDate), sevenFwd),
      );
    } else if (tableFilters.due === 'noDate') {
      list = list.filter((i) => !i.dueDate);
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
  }, [incidents, dashboardFilters, riskFilter, sortField, tableFilters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems: Incident[] = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleSort(field: 'priority' | 'dueDate') {
    setSortField(field);
    setPage(1);
  }

  function handleTableFiltersChange(f: TableFilters) {
    setTableFilters(f);
    setPage(1);
  }

  return (
    <section className={styles.section} aria-label="Lista de incidencias">
      <div className={styles.header}>
        <h2 className={styles.header__title}>
          Incidencias
          {riskFilter && <span className={styles.header__badge}> (filtrado por riesgo)</span>}
        </h2>
        <div className={styles.header__right}>
          <p className={styles.header__count}>
            {filtered.length === 0
              ? '0 resultados'
              : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} de ${filtered.length}`}
          </p>
          <button
            className={`${styles.filterBtn} ${activeFilterCount > 0 ? styles['filterBtn--active'] : ''}`}
            onClick={() => setShowFilterModal(true)}
            aria-label="Filtrar tabla de incidencias"
          >
            <SlidersHorizontal size={14} />
            <span>Filtrar</span>
            {activeFilterCount > 0 && (
              <span className={styles.filterBtn__badge}>{activeFilterCount}</span>
            )}
          </button>
        </div>
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
              <th className={styles.th}>Creado por</th>
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
                <td colSpan={7} className={styles.empty}>
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
                      <div className={styles.ownerCell}>
                        <UserAvatar
                          name={incident.owner?.name ?? 'Sin asignar'}
                          avatarUrl={incident.owner?.avatarUrl}
                        />
                        <span className={styles.ownerCell__name}>
                          {incident.owner?.name ?? 'Sin asignar'}
                        </span>
                      </div>
                    </td>
                    <td className={styles.td}>
                      <div className={styles.avatars}>
                        {incident.assignees.slice(0, 3).map((a) => (
                          <UserAvatar key={a.id} name={a.name} avatarUrl={a.avatarUrl} />
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

      {showFilterModal && (
        <TableFiltersModal
          filters={tableFilters}
          onChange={handleTableFiltersChange}
          onClose={() => setShowFilterModal(false)}
        />
      )}
    </section>
  );
}
