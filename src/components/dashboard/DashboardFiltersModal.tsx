'use client';
/**
 * Advanced dashboard filters modal. Edits a local draft of the filter set
 * (period, status, priority, user/company) and only commits it to the filters
 * store on "Apply", so the dashboard doesn't re-render on every keystroke.
 */
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useModalStore } from '@/store/useModalStore';
import { useFiltersStore } from '@/store/useFiltersStore';
import type { DashboardFilters, DashboardPeriod } from '@/domain/models/filters.model';
import type { IncidentStatus, IncidentPriority } from '@/domain/models/incident.model';
import { MOCK_USERS } from '@/lib/constants/mock-users';
import styles from './DashboardFiltersModal.module.scss';

const PERIODS: { value: DashboardPeriod; label: string }[] = [
  { value: '7d', label: 'Últimos 7 días' },
  { value: '15d', label: 'Últimos 15 días' },
  { value: '30d', label: 'Últimos 30 días' },
  { value: '90d', label: 'Últimos 90 días' },
  { value: '6m', label: 'Últimos 6 meses' },
];

const STATUSES: { value: IncidentStatus; label: string }[] = [
  { value: 'open', label: 'Abierta' },
  { value: 'on_pause', label: 'Pausada' },
  { value: 'closed', label: 'Cerrada' },
];

const PRIORITIES: { value: IncidentPriority; label: string }[] = [
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Media' },
  { value: 'low', label: 'Baja' },
];

const COMPANIES = Array.from(new Set(MOCK_USERS.map((u) => u.company)));

function toggle<T>(arr: T[] | undefined, item: T): T[] {
  const current = arr ?? [];
  return current.includes(item) ? current.filter((x) => x !== item) : [...current, item];
}

/** Reusable row of toggleable chips for a single multi-select filter. */
function ChipGroup<T extends string>({
  options,
  selected,
  onToggle,
}: {
  options: { value: T; label: string }[];
  selected: T[] | undefined;
  onToggle: (v: T) => void;
}) {
  return (
    <div className={styles.chipGroup}>
      {options.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          className={`${styles.chip} ${selected?.includes(value) ? styles['chip--active'] : ''}`}
          onClick={() => onToggle(value)}
          aria-pressed={selected?.includes(value) ?? false}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default function DashboardFiltersModal() {
  const activeModal = useModalStore((s) => s.activeModal);
  const closeModal = useModalStore((s) => s.close);
  const dashboardFilters = useFiltersStore((s) => s.dashboardFilters);
  const setDashboardFilters = useFiltersStore((s) => s.setDashboardFilters);
  const resetDashboardFilters = useFiltersStore((s) => s.resetDashboardFilters);

  const [draft, setDraft] = useState<DashboardFilters>(dashboardFilters);

  useEffect(() => {
    if (activeModal === 'dashboard-filters') {
      setDraft(dashboardFilters);
    }
  }, [activeModal, dashboardFilters]);

  if (activeModal !== 'dashboard-filters') return null;

  function handleApply() {
    setDashboardFilters(draft);
    closeModal();
  }

  function handleReset() {
    resetDashboardFilters();
    closeModal();
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal aria-label="Filtros del dashboard">
      <div className={styles.modal}>
        <div className={styles.modal__header}>
          <h2 className={styles.modal__title}>Filtros del dashboard</h2>
          <button className={styles.modal__close} onClick={closeModal} aria-label="Cerrar filtros">
            <X size={18} />
          </button>
        </div>

        <div className={styles.modal__body}>
          <fieldset className={styles.field}>
            <legend className={styles.field__label}>Período</legend>
            <ChipGroup
              options={PERIODS}
              selected={[draft.period]}
              onToggle={(v) => setDraft((d) => ({ ...d, period: v }))}
            />
          </fieldset>

          <fieldset className={styles.field}>
            <legend className={styles.field__label}>Estado</legend>
            <ChipGroup
              options={STATUSES}
              selected={draft.status}
              onToggle={(v) => setDraft((d) => ({ ...d, status: toggle(d.status, v) }))}
            />
          </fieldset>

          <fieldset className={styles.field}>
            <legend className={styles.field__label}>Prioridad</legend>
            <ChipGroup
              options={PRIORITIES}
              selected={draft.priority}
              onToggle={(v) => setDraft((d) => ({ ...d, priority: toggle(d.priority, v) }))}
            />
          </fieldset>

          <fieldset className={styles.field}>
            <legend className={styles.field__label}>Creado por (compañía)</legend>
            <ChipGroup
              options={COMPANIES.map((c) => ({ value: c, label: c }))}
              selected={draft.createdByCompany}
              onToggle={(v) =>
                setDraft((d) => ({ ...d, createdByCompany: toggle(d.createdByCompany, v) }))
              }
            />
          </fieldset>

          <fieldset className={styles.field}>
            <legend className={styles.field__label}>Creado por (usuario)</legend>
            <div className={styles.userList}>
              {MOCK_USERS.map((u) => {
                const active = draft.createdByUser?.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    className={`${styles.userChip} ${active ? styles['userChip--active'] : ''}`}
                    onClick={() =>
                      setDraft((d) => ({ ...d, createdByUser: toggle(d.createdByUser, u.id) }))
                    }
                    aria-pressed={active ?? false}
                  >
                    <span className={styles.userChip__avatar}>{u.name.charAt(0)}</span>
                    <span className={styles.userChip__name}>{u.name}</span>
                    <span className={styles.userChip__company}>{u.company}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className={styles.field}>
            <legend className={styles.field__label}>Responsable por (compañía)</legend>
            <ChipGroup
              options={COMPANIES.map((c) => ({ value: c, label: c }))}
              selected={draft.responsibleByCompany}
              onToggle={(v) =>
                setDraft((d) => ({
                  ...d,
                  responsibleByCompany: toggle(d.responsibleByCompany, v),
                }))
              }
            />
          </fieldset>

          <fieldset className={styles.field}>
            <legend className={styles.field__label}>Responsable (usuario)</legend>
            <div className={styles.userList}>
              {MOCK_USERS.map((u) => {
                const active = draft.responsibleUser?.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    className={`${styles.userChip} ${active ? styles['userChip--active'] : ''}`}
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        responsibleUser: toggle(d.responsibleUser, u.id),
                      }))
                    }
                    aria-pressed={active ?? false}
                  >
                    <span className={styles.userChip__avatar}>{u.name.charAt(0)}</span>
                    <span className={styles.userChip__name}>{u.name}</span>
                    <span className={styles.userChip__company}>{u.company}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>

        <div className={styles.modal__footer}>
          <button type="button" className={styles.btnSecondary} onClick={handleReset}>
            Limpiar filtros
          </button>
          <button type="button" className={styles.btnPrimary} onClick={handleApply}>
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}
