'use client';
/**
 * Read-only detail view for a single incident, shared by the map and dashboard.
 * Reads the selected id from the detail store and resolves the full incident
 * from the issues store. Also bridges the imperative Mapbox popup links by
 * intercepting their clicks at the document level to open the modal.
 */
import { useEffect } from 'react';
import { X, MapPin, Calendar, Clock, FileText } from 'lucide-react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useIncidentDetailStore } from '@/store/useIncidentDetailStore';
import { useIssuesStore } from '@/store/useIssuesStore';
import type { UserRef } from '@/domain/models/incident.model';
import styles from './IncidentDetailModal.module.scss';

const PRIORITY_LABELS: Record<string, string> = { high: 'Alta', medium: 'Media', low: 'Baja' };
const STATUS_LABELS: Record<string, string> = {
  open: 'Abierta',
  on_pause: 'Pausada',
  closed: 'Cerrada',
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

  const incident = incidents.find((i) => i.id === selectedIncidentId);
  if (!incident) return null;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal
      aria-labelledby="incident-detail-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeDetail();
      }}
    >
      <div className={styles.modal}>
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
            <span className={`${styles.badge} ${styles['badge--type']}`}>{incident.type.name}</span>
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
      </div>
    </div>
  );
}
