'use client';
/**
 * Map toolbar's "BIM Plans" button, made functional (roadmap 8.11,
 * requirements.md §1.2 Could): real image/PDF plans attached to a project,
 * not a native BIM/IFC viewer (explicitly Won't v1). Viewing is open to any
 * org member; attaching/deleting is admin+ — UI-gated here, backend re-checks
 * regardless (same convention as IncidentDetailModal's approval section).
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'motion/react';
import {
  X,
  Upload,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  Trash2,
  Loader2,
} from 'lucide-react';
import { useModalStore } from '@/store/useModalStore';
import { useAuthStore } from '@/store/useAuthStore';
import { getProjects } from '@/services/catalogs.service';
import {
  listProjectPlans,
  uploadProjectPlan,
  deleteProjectPlan,
} from '@/services/project-plans.service';
import { useDialogMotion } from '@/hooks/useDialogMotion';
import type { Project, ProjectPlan } from '@/domain/models';
import styles from './ProjectPlansModal.module.scss';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

export default function ProjectPlansModal() {
  const activeModal = useModalStore((s) => s.activeModal);
  const isOpen = activeModal === 'project-plans';

  // Shell/content split (F9.7): AnimatePresence stays mounted so the exit
  // transition still plays, while the content below mounts fresh on each open.
  // Its initial state is then the state the modal should open in, which is what
  // the on-open effect used to have to arrange after the first render.
  return <AnimatePresence>{isOpen && <ProjectPlansModalContent />}</AnimatePresence>;
}

function ProjectPlansModalContent() {
  const t = useTranslations('planos');
  const close = useModalStore((s) => s.close);

  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  // `null` means "not fetched yet", which is the whole of what the old
  // `loadingProjects` flag tracked — and the modal mounts on open, so it
  // starts in exactly that state without an effect setting it.
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const loadingProjects = projects === null;

  const [plans, setPlans] = useState<ProjectPlan[]>([]);
  // Which project `plans` actually describes. The plans list, unlike the
  // project list, reloads whenever the user picks another project, so
  // "loading" can't just be the initial state — but it is still derivable:
  // we are loading exactly while the plans in hand belong to a different
  // project than the selected one. Deriving it during render is what keeps
  // the switch from flashing the previous project's plans, which is what a
  // plain `plans === null` check would have done here.
  const [plansProjectId, setPlansProjectId] = useState<string | null>(null);
  const loadingPlans = selectedProjectId !== '' && plansProjectId !== selectedProjectId;

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const projectOptions = projects ?? [];

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { overlay, panel } = useDialogMotion();

  useEffect(() => {
    let cancelled = false;
    getProjects()
      .then((list) => {
        if (cancelled) return;
        setProjects(list);
        setSelectedProjectId((prev) => prev || (list[0]?.id ?? ''));
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    let cancelled = false;
    listProjectPlans(selectedProjectId)
      .then((list) => {
        if (cancelled) return;
        setPlans(list);
        setPlansProjectId(selectedProjectId);
      })
      .catch(() => {
        if (cancelled) return;
        setPlans([]);
        setPlansProjectId(selectedProjectId);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close]);

  const handleClose = () => {
    setUploadError('');
    close();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedProjectId) return;

    setUploading(true);
    setUploadError('');
    try {
      const plan = await uploadProjectPlan(selectedProjectId, file);
      setPlans((prev) => [plan, ...prev]);
    } catch {
      setUploadError(t('uploadError'));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteProjectPlan(id);
      setPlans((prev) => prev.filter((p) => p.id !== id));
    } catch {
      // Left as-is on failure; the row stays visible.
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <motion.div
      className={styles.overlay}
      variants={overlay}
      initial="hidden"
      animate="visible"
      exit="exit"
      role="dialog"
      aria-modal="true"
      aria-label={t('ariaLabel')}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <motion.div className={styles.modal} variants={panel}>
        <div className={styles.header}>
          <h3>{t('title')}</h3>
          <button
            type="button"
            className={styles.close}
            onClick={handleClose}
            aria-label={t('close')}
          >
            <X size={16} />
          </button>
        </div>

        <div className={styles.body}>
          <p className={styles.intro}>{t('intro')}</p>

          <label className={styles['project-picker']}>
            <span>{t('projectLabel')}</span>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              disabled={loadingProjects || projectOptions.length === 0}
              aria-label={t('projectAriaLabel')}
            >
              {projectOptions.length === 0 && <option value="">{t('noProjects')}</option>}
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          {isAdmin && (
            <div className={styles['upload-row']}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                onChange={handleFileSelected}
                disabled={uploading || !selectedProjectId}
                className={styles['upload-row__input']}
                id="project-plan-upload"
              />
              <label htmlFor="project-plan-upload" className={styles['upload-row__button']}>
                {uploading ? <Loader2 size={14} className={styles.spin} /> : <Upload size={14} />}
                {uploading ? t('uploading') : t('attachPlan')}
              </label>
              <span className={styles['upload-row__hint']}>{t('acceptedFormats')}</span>
            </div>
          )}

          {uploadError && (
            <p className={styles.error} role="alert">
              {uploadError}
            </p>
          )}

          <div className={styles.list} role="list" aria-label={t('listAriaLabel')}>
            {loadingPlans ? (
              <p className={styles.empty}>{t('loading')}</p>
            ) : plans.length === 0 ? (
              <p className={styles.empty}>{t('empty')}</p>
            ) : (
              plans.map((plan) => (
                <div key={plan.id} className={styles.item} role="listitem">
                  <span className={styles.item__icon} aria-hidden="true">
                    {plan.type === 'image' ? <ImageIcon size={16} /> : <FileText size={16} />}
                  </span>
                  <div className={styles.item__info}>
                    <span className={styles.item__name} title={plan.name}>
                      {plan.name}
                    </span>
                    <span className={styles.item__meta}>{formatFileSize(plan.size)}</span>
                  </div>
                  <a
                    className={styles.item__open}
                    href={plan.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t('openAriaLabel', { name: plan.name })}
                  >
                    <ExternalLink size={14} />
                  </a>
                  {isAdmin && (
                    <button
                      type="button"
                      className={styles.item__delete}
                      onClick={() => handleDelete(plan.id)}
                      disabled={deletingId === plan.id}
                      aria-label={t('deleteAriaLabel', { name: plan.name })}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
