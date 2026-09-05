'use client';
/**
 * Advanced dashboard filters modal. Edits a local draft of the filter set
 * (period, status, priority, user/company) and only commits it to the filters
 * store on "Apply", so the dashboard doesn't re-render on every keystroke.
 */
import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { useModalStore } from '@/store/useModalStore';
import { useFiltersStore } from '@/store/useFiltersStore';
import { useIssuesStore } from '@/store/useIssuesStore';
import { useDialogMotion } from '@/hooks/useDialogMotion';
import type { DashboardFilters, DashboardPeriod } from '@/domain/models/filters.model';
import type { IncidentStatus, IncidentPriority, UserRef } from '@/domain/models/incident.model';
import styles from './DashboardFiltersModal.module.scss';

const PERIODS: { value: DashboardPeriod; labelKey: string }[] = [
  { value: '7d', labelKey: 'filtersModalPeriod7d' },
  { value: '15d', labelKey: 'filtersModalPeriod15d' },
  { value: '30d', labelKey: 'filtersModalPeriod30d' },
  { value: '90d', labelKey: 'filtersModalPeriod90d' },
  { value: '6m', labelKey: 'filtersModalPeriod6m' },
];

const STATUSES: { value: IncidentStatus; labelKey: string }[] = [
  { value: 'open', labelKey: 'statusOpen' },
  { value: 'on_pause', labelKey: 'statusOnPause' },
  { value: 'closed', labelKey: 'statusClosed' },
];

const PRIORITIES: { value: IncidentPriority; labelKey: string }[] = [
  { value: 'high', labelKey: 'priorityHigh' },
  { value: 'medium', labelKey: 'priorityMedium' },
  { value: 'low', labelKey: 'priorityLow' },
];

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
  const t = useTranslations('dashboard');
  const activeModal = useModalStore((s) => s.activeModal);
  const closeModal = useModalStore((s) => s.close);
  const dashboardFilters = useFiltersStore((s) => s.dashboardFilters);
  const setDashboardFilters = useFiltersStore((s) => s.setDashboardFilters);
  const resetDashboardFilters = useFiltersStore((s) => s.resetDashboardFilters);
  const incidents = useIssuesStore((s) => s.incidents);
  const { overlay, panel } = useDialogMotion();
  const isOpen = activeModal === 'dashboard-filters';

  const [draft, setDraft] = useState<DashboardFilters>(dashboardFilters);

  // Only offer people who actually appear in the current incident set —
  // a real backend org-members fetch would list teammates with zero results too.
  const { creators, responsibles } = useMemo(() => {
    const creatorsById = new Map<string, UserRef>();
    const responsiblesById = new Map<string, UserRef>();
    incidents.forEach((i) => {
      if (i.owner?.id) creatorsById.set(i.owner.id, i.owner);
      (i.assignees ?? []).forEach((a) => {
        if (a?.id) responsiblesById.set(a.id, a);
      });
    });
    return {
      creators: Array.from(creatorsById.values()),
      responsibles: Array.from(responsiblesById.values()),
    };
  }, [incidents]);

  useEffect(() => {
    if (activeModal === 'dashboard-filters') {
      setDraft(dashboardFilters);
    }
  }, [activeModal, dashboardFilters]);

  function handleApply() {
    setDashboardFilters(draft);
    closeModal();
  }

  function handleReset() {
    resetDashboardFilters();
    closeModal();
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={styles.overlay}
          variants={overlay}
          initial="hidden"
          animate="visible"
          exit="exit"
          role="dialog"
          aria-modal
          aria-label={t('filtersModalOverlayAriaLabel')}
        >
          <motion.div className={styles.modal} variants={panel}>
            <div className={styles.modal__header}>
              <h2 className={styles.modal__title}>{t('filtersModalTitle')}</h2>
              <button
                className={styles.modal__close}
                onClick={closeModal}
                aria-label={t('filtersModalCloseAriaLabel')}
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.modal__body}>
              <fieldset className={styles.field}>
                <legend className={styles.field__label}>{t('filtersModalLegendPeriod')}</legend>
                <ChipGroup
                  options={PERIODS.map((p) => ({ value: p.value, label: t(p.labelKey) }))}
                  selected={[draft.period]}
                  onToggle={(v) => setDraft((d) => ({ ...d, period: v }))}
                />
              </fieldset>

              <fieldset className={styles.field}>
                <legend className={styles.field__label}>{t('filtersModalLegendStatus')}</legend>
                <ChipGroup
                  options={STATUSES.map((s) => ({ value: s.value, label: t(s.labelKey) }))}
                  selected={draft.status}
                  onToggle={(v) => setDraft((d) => ({ ...d, status: toggle(d.status, v) }))}
                />
              </fieldset>

              <fieldset className={styles.field}>
                <legend className={styles.field__label}>{t('filtersModalLegendPriority')}</legend>
                <ChipGroup
                  options={PRIORITIES.map((p) => ({ value: p.value, label: t(p.labelKey) }))}
                  selected={draft.priority}
                  onToggle={(v) => setDraft((d) => ({ ...d, priority: toggle(d.priority, v) }))}
                />
              </fieldset>

              <fieldset className={styles.field}>
                <legend className={styles.field__label}>
                  {t('filtersModalLegendCreatedByUser')}
                </legend>
                <div className={styles.userList}>
                  {creators.map((u) => {
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
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset className={styles.field}>
                <legend className={styles.field__label}>
                  {t('filtersModalLegendResponsibleByUser')}
                </legend>
                <div className={styles.userList}>
                  {responsibles.map((u) => {
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
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </div>

            <div className={styles.modal__footer}>
              <button type="button" className={styles.btnSecondary} onClick={handleReset}>
                {t('filtersModalClearFilters')}
              </button>
              <button type="button" className={styles.btnPrimary} onClick={handleApply}>
                {t('filtersModalApply')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
