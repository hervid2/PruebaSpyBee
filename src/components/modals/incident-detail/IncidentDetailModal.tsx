'use client';
/**
 * Read-only detail view for a single incident, shared by the map and dashboard.
 * Reads the selected id from the detail store and resolves the full incident
 * from the issues store. Also bridges the imperative Mapbox popup links by
 * intercepting their clicks at the document level to open the modal.
 */
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, MapPin, Calendar, Clock, FileText } from 'lucide-react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useIncidentDetailStore } from '@/store/useIncidentDetailStore';
import { useIssuesStore } from '@/store/useIssuesStore';
import { useAuthStore } from '@/store/useAuthStore';
import {
  updateIncidentStatus,
  deleteIncident,
  updateIncidentApproval,
} from '@/services/incident-mutations.service';
import { ApiError } from '@/lib/api-client';
import { useDialogMotion } from '@/hooks/useDialogMotion';
import type { UserRef, IncidentStatus } from '@/domain/models/incident.model';
import styles from './IncidentDetailModal.module.scss';

const PRIORITY_LABELS: Record<string, string> = { high: 'Alta', medium: 'Media', low: 'Baja' };
const STATUS_LABELS: Record<string, string> = {
  open: 'Abierta',
  on_pause: 'Pausada',
  closed: 'Cerrada',
};
const STATUS_OPTIONS: IncidentStatus[] = ['open', 'on_pause', 'closed'];
const APPROVAL_LABELS: Record<string, string> = {
  pending: 'Pendiente de aprobación',
  approved: 'Aprobada',
  rejected: 'Rechazada',
};

/** Small avatar + name chip reused for owner, assignees and observers. */
function UserChip({ user }: { user: UserRef }) {
  return (
    <div className={styles.chip}>
      <div className={styles.chip__avatar}>
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatarUrl} alt={user.name} />
        ) : (
          user.name.charAt(0).toUpperCase()
        )}
      </div>
      <span className={styles.chip__name}>{user.name}</span>
    </div>
  );
}

export default function IncidentDetailModal() {
  const { selectedIncidentId, openDetail, closeDetail } = useIncidentDetailStore();
  const incidents = useIssuesStore((s) => s.incidents);
  const updateIncidentInStore = useIssuesStore((s) => s.updateIncident);
  const removeIncidentFromStore = useIssuesStore((s) => s.removeIncident);
  const currentUser = useAuthStore((s) => s.user);
  const [statusPending, setStatusPending] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [approvalPending, setApprovalPending] = useState(false);
  const [approvalError, setApprovalError] = useState('');
  const [rejectingReason, setRejectingReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const { overlay, panel } = useDialogMotion();

  // Intercept "Ver detalles" clicks from Mapbox popups (DOM-rendered, not React)
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const link = (e.target as Element).closest<HTMLAnchorElement>('.incident-popup__link');
      if (!link) return;
      e.preventDefault();
      const id = link.dataset.id;
      if (id) openDetail(id);
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [openDetail]);

  // Close on Escape
  useEffect(() => {
    if (!selectedIncidentId) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeDetail();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [selectedIncidentId, closeDetail]);

  // Reset transient action state whenever the open incident changes.
  useEffect(() => {
    setStatusError('');
    setConfirmingDelete(false);
    setApprovalError('');
    setShowRejectForm(false);
    setRejectingReason('');
  }, [selectedIncidentId]);

  const incident = incidents.find((i) => i.id === selectedIncidentId);
  // Keeps AnimatePresence itself mounted (same element at the same tree
  // position every render) so it can still play the exit transition on the
  // motion.div below when incident disappears — an unconditional `return
  // null` here would unmount AnimatePresence too and skip the exit animation.
  if (!incident) return <AnimatePresence>{null}</AnimatePresence>;

  // Mirrors the backend's own permission check (canEdit/remove in
  // incidents.service.ts) for UI gating only — the backend is still the
  // real authority and re-checks on every request.
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
  const isOwnerOrAssignee =
    !!currentUser &&
    (incident.owner.id === currentUser.id ||
      incident.assignees.some((a) => a.id === currentUser.id));
  const canChangeStatus = isAdmin || isOwnerOrAssignee;
  const canDelete = isAdmin || incident.owner.id === currentUser?.id;
  const canDecideApproval = isAdmin && incident.approval === 'pending';

  const handleStatusChange = async (next: IncidentStatus) => {
    if (next === incident.status) return;
    setStatusError('');
    setStatusPending(true);
    try {
      const updated = await updateIncidentStatus(incident.id, next);
      updateIncidentInStore(updated);
    } catch (err) {
      setStatusError(
        err instanceof ApiError && err.status === 409
          ? 'Transición de estado no permitida.'
          : 'No se pudo cambiar el estado.',
      );
    } finally {
      setStatusPending(false);
    }
  };

  const handleApprove = async () => {
    setApprovalError('');
    setApprovalPending(true);
    try {
      const updated = await updateIncidentApproval(incident.id, 'approved');
      updateIncidentInStore(updated);
    } catch (err) {
      setApprovalError(
        err instanceof ApiError && err.status === 409
          ? 'Esta incidencia ya fue decidida.'
          : 'No se pudo aprobar la incidencia.',
      );
    } finally {
      setApprovalPending(false);
    }
  };

  const handleReject = async () => {
    setApprovalError('');
    setApprovalPending(true);
    try {
      const updated = await updateIncidentApproval(
        incident.id,
        'rejected',
        rejectingReason.trim() || undefined,
      );
      updateIncidentInStore(updated);
      setShowRejectForm(false);
      setRejectingReason('');
    } catch (err) {
      setApprovalError(
        err instanceof ApiError && err.status === 409
          ? 'Esta incidencia ya fue decidida.'
          : 'No se pudo rechazar la incidencia.',
      );
    } finally {
      setApprovalPending(false);
    }
  };

  const handleDelete = async () => {
    setDeletePending(true);
    try {
      await deleteIncident(incident.id);
      removeIncidentFromStore(incident.id);
      closeDetail();
    } catch {
      setDeletePending(false);
      setConfirmingDelete(false);
      setStatusError('No se pudo eliminar la incidencia.');
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className={styles.overlay}
        variants={overlay}
        initial="hidden"
        animate="visible"
        exit="exit"
        role="dialog"
        aria-modal
        aria-labelledby="incident-detail-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) closeDetail();
        }}
      >
        <motion.div className={styles.modal} variants={panel}>
          {/* ── Header ── */}
          <div className={styles.modal__header}>
            <div className={styles.modal__meta}>
              <span className={styles.modal__code}>#{incident.sequenceId}</span>
              <span className={`${styles.badge} ${styles[`badge--priority-${incident.priority}`]}`}>
                {PRIORITY_LABELS[incident.priority]}
              </span>
              <span className={`${styles.badge} ${styles[`badge--status-${incident.status}`]}`}>
                {STATUS_LABELS[incident.status]}
              </span>
              <span className={`${styles.badge} ${styles[`badge--approval-${incident.approval}`]}`}>
                {APPROVAL_LABELS[incident.approval]}
              </span>
              <span className={`${styles.badge} ${styles['badge--type']}`}>
                {incident.type.name}
              </span>
            </div>
            <button
              className={styles.modal__close}
              onClick={closeDetail}
              aria-label="Cerrar detalle de incidencia"
            >
              <X size={18} />
            </button>
          </div>

          {/* ── Title ── */}
          <h2 id="incident-detail-title" className={styles.modal__title}>
            {incident.title}
          </h2>

          {/* ── Description ── */}
          {incident.description && (
            <section className={styles.section}>
              <h3 className={styles.section__label}>Descripción</h3>
              <p className={styles.section__text}>{incident.description}</p>
            </section>
          )}

          {/* ── People ── */}
          <section className={styles.section}>
            <h3 className={styles.section__label}>Personas</h3>
            <div className={styles.peopleGrid}>
              <div>
                <span className={styles.peopleGrid__role}>Creado por</span>
                <UserChip user={incident.owner} />
              </div>
              {incident.assignees.length > 0 && (
                <div>
                  <span className={styles.peopleGrid__role}>Asignados</span>
                  <div className={styles.userList}>
                    {incident.assignees.map((a) => (
                      <UserChip key={a.id} user={a} />
                    ))}
                  </div>
                </div>
              )}
              {incident.observers.length > 0 && (
                <div>
                  <span className={styles.peopleGrid__role}>Observadores</span>
                  <div className={styles.userList}>
                    {incident.observers.map((o) => (
                      <UserChip key={o.id} user={o} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ── Tags ── */}
          {incident.tags.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.section__label}>Etiquetas</h3>
              <div className={styles.tags}>
                {incident.tags.map((t) => (
                  <span
                    key={t.id}
                    className={styles.tag}
                    style={{
                      background: `${t.color}22`,
                      color: t.color,
                      borderColor: `${t.color}55`,
                    }}
                  >
                    {t.name}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* ── Metadata ── */}
          <section className={styles.section}>
            <h3 className={styles.section__label}>Detalles</h3>
            <div className={styles.metaGrid}>
              {incident.dueDate && (
                <div className={styles.metaItem}>
                  <Calendar size={14} className={styles.metaItem__icon} aria-hidden />
                  <div>
                    <span className={styles.metaItem__label}>Vencimiento</span>
                    <span className={styles.metaItem__value}>
                      {format(parseISO(incident.dueDate), "d 'de' MMMM yyyy", { locale: es })}
                    </span>
                  </div>
                </div>
              )}
              {incident.locationDescription && (
                <div className={styles.metaItem}>
                  <MapPin size={14} className={styles.metaItem__icon} aria-hidden />
                  <div>
                    <span className={styles.metaItem__label}>Ubicación</span>
                    <span className={styles.metaItem__value}>{incident.locationDescription}</span>
                  </div>
                </div>
              )}
              {incident.media.length > 0 && (
                <div className={styles.metaItem}>
                  <FileText size={14} className={styles.metaItem__icon} aria-hidden />
                  <div>
                    <span className={styles.metaItem__label}>Archivos adjuntos</span>
                    <span className={styles.metaItem__value}>
                      {incident.media.length} archivo{incident.media.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              )}
              <div className={styles.metaItem}>
                <Clock size={14} className={styles.metaItem__icon} aria-hidden />
                <div>
                  <span className={styles.metaItem__label}>Creada</span>
                  <span className={styles.metaItem__value}>
                    {formatDistanceToNow(parseISO(incident.createdAt), {
                      locale: es,
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>
              <div className={styles.metaItem}>
                <Clock size={14} className={styles.metaItem__icon} aria-hidden />
                <div>
                  <span className={styles.metaItem__label}>Última actualización</span>
                  <span className={styles.metaItem__value}>
                    {formatDistanceToNow(parseISO(incident.updatedAt), {
                      locale: es,
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* ── Aprobación (admin+, solo mientras está pendiente) ── */}
          {canDecideApproval && (
            <section className={styles.section}>
              <h3 className={styles.section__label}>Aprobación</h3>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.approveBtn}
                  onClick={handleApprove}
                  disabled={approvalPending}
                >
                  {approvalPending ? 'Procesando…' : 'Aprobar'}
                </button>

                {showRejectForm ? (
                  <div className={styles.rejectForm}>
                    <input
                      type="text"
                      className={styles.rejectForm__input}
                      placeholder="Motivo del rechazo (opcional)"
                      value={rejectingReason}
                      onChange={(e) => setRejectingReason(e.target.value)}
                      disabled={approvalPending}
                      aria-label="Motivo del rechazo"
                    />
                    <button
                      type="button"
                      className={styles.rejectForm__confirm}
                      onClick={handleReject}
                      disabled={approvalPending}
                    >
                      {approvalPending ? 'Procesando…' : 'Confirmar rechazo'}
                    </button>
                    <button
                      type="button"
                      className={styles.rejectForm__cancel}
                      onClick={() => {
                        setShowRejectForm(false);
                        setRejectingReason('');
                      }}
                      disabled={approvalPending}
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={styles.rejectBtn}
                    onClick={() => setShowRejectForm(true)}
                    disabled={approvalPending}
                  >
                    Rechazar
                  </button>
                )}
              </div>
              {approvalError && (
                <p className={styles.error} role="alert">
                  {approvalError}
                </p>
              )}
            </section>
          )}

          {/* ── Acciones ── */}
          {(canChangeStatus || canDelete) && (
            <section className={styles.section}>
              <h3 className={styles.section__label}>Acciones</h3>
              <div className={styles.actions}>
                {canChangeStatus && (
                  <select
                    className={styles.statusSelect}
                    value={incident.status}
                    disabled={statusPending}
                    aria-label="Cambiar estado"
                    onChange={(e) => handleStatusChange(e.target.value as IncidentStatus)}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                )}

                {canDelete &&
                  (confirmingDelete ? (
                    <div className={styles.confirmDelete}>
                      <span>¿Eliminar esta incidencia?</span>
                      <button
                        type="button"
                        className={styles.confirmDelete__yes}
                        onClick={handleDelete}
                        disabled={deletePending}
                      >
                        {deletePending ? 'Eliminando…' : 'Sí, eliminar'}
                      </button>
                      <button
                        type="button"
                        className={styles.confirmDelete__no}
                        onClick={() => setConfirmingDelete(false)}
                        disabled={deletePending}
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      onClick={() => setConfirmingDelete(true)}
                    >
                      Eliminar
                    </button>
                  ))}
              </div>
              {statusError && (
                <p className={styles.error} role="alert">
                  {statusError}
                </p>
              )}
            </section>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
