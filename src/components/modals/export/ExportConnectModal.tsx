'use client';
/**
 * "Export and connect" (roadmap 8.10, requirements.md §1.10): manages the
 * user's long-lived data token and shows the resulting `/reports/dashboard-data`
 * URL, meant to be pasted once into Power BI's Web connector or Looker
 * Studio. Structurally mirrors InviteCollaboratorsModal (generate → show a
 * copyable link once) — the backend never persists the raw token either.
 */
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'motion/react';
import { X, Check, Copy } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useModalStore } from '@/store/useModalStore';
import {
  getDataTokenStatus,
  generateDataToken,
  revokeDataToken,
  type DataTokenStatus,
} from '@/services/reports.service';
import { useDialogMotion } from '@/hooks/useDialogMotion';
import styles from './ExportConnectModal.module.scss';

export default function ExportConnectModal() {
  const activeModal = useModalStore((s) => s.activeModal);
  const isOpen = activeModal === 'export-connect';

  // Shell/content split (F9.7): AnimatePresence stays mounted so the exit
  // transition still plays, while the content below mounts fresh on each open.
  // Its initial state is then the state the modal should open in, which is what
  // the on-open effect used to have to arrange after the first render.
  return <AnimatePresence>{isOpen && <ExportConnectModalContent />}</AnimatePresence>;
}

function ExportConnectModalContent() {
  const t = useTranslations('dashboard');
  const close = useModalStore((s) => s.close);

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<DataTokenStatus | null>(null);
  const [newUrl, setNewUrl] = useState('');
  const [busyAction, setBusyAction] = useState<'generate' | 'revoke' | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const { overlay, panel } = useDialogMotion();

  // `loading`, `newUrl` and `error` already start in the state a freshly
  // opened modal wants, because this component mounts on open — the effect no
  // longer has to reset them before fetching. The cancellation flag matters
  // now that closing really does unmount: without it, a modal closed mid-flight
  // would still setState on the way back.
  useEffect(() => {
    let cancelled = false;
    getDataTokenStatus()
      .then((next) => {
        if (!cancelled) setStatus(next);
      })
      .catch(() => {
        if (!cancelled) setError(t('exportConnectError'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close]);

  const handleGenerate = async () => {
    setBusyAction('generate');
    setError('');
    try {
      const created = await generateDataToken();
      setNewUrl(created.dashboardDataUrl);
      setStatus({ hasToken: true, createdAt: created.createdAt });
    } catch {
      setError(t('exportConnectError'));
    } finally {
      setBusyAction(null);
    }
  };

  const handleRevoke = async () => {
    setBusyAction('revoke');
    setError('');
    try {
      await revokeDataToken();
      setStatus({ hasToken: false, createdAt: null });
      setNewUrl('');
    } catch {
      setError(t('exportConnectError'));
    } finally {
      setBusyAction(null);
    }
  };

  const handleCopy = async () => {
    if (!newUrl) return;
    try {
      await navigator.clipboard.writeText(newUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission denied — the link is still visible to copy manually.
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
      aria-label={t('exportConnectAriaLabel')}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <motion.div className={styles.modal} variants={panel}>
        <div className={styles.header}>
          <h3>{t('exportConnectTitle')}</h3>
          <button
            type="button"
            className={styles.close}
            onClick={close}
            aria-label={t('exportConnectClose')}
          >
            <X size={16} />
          </button>
        </div>

        <div className={styles.body}>
          <p className={styles.intro}>{t('exportConnectIntro')}</p>

          {loading ? (
            <p className={styles.status}>{t('exportConnectLoading')}</p>
          ) : (
            <>
              {!error && status?.hasToken && !newUrl && (
                <p className={styles.status}>
                  {t('exportConnectExistingToken', {
                    date: status.createdAt
                      ? format(parseISO(status.createdAt), "d 'de' MMM yyyy", { locale: es })
                      : '',
                  })}
                </p>
              )}
              {!error && !status?.hasToken && !newUrl && (
                <p className={styles.status}>{t('exportConnectNoTokenHint')}</p>
              )}

              {newUrl && (
                <div className={styles['link-panel']} role="status">
                  <p className={styles['link-panel__label']}>{t('exportConnectLinkReady')}</p>
                  <div className={styles['link-panel__row']}>
                    <input type="text" readOnly value={newUrl} />
                    <button
                      type="button"
                      onClick={() => void handleCopy()}
                      aria-label={t('exportConnectCopyAriaLabel')}
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? t('exportConnectCopied') : t('exportConnectCopy')}
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}

              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={() => void handleGenerate()}
                  disabled={busyAction !== null}
                >
                  {busyAction === 'generate'
                    ? status?.hasToken
                      ? t('exportConnectRegenerating')
                      : t('exportConnectGenerating')
                    : status?.hasToken
                      ? t('exportConnectRegenerate')
                      : t('exportConnectGenerate')}
                </button>
                {status?.hasToken && (
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={() => void handleRevoke()}
                    disabled={busyAction !== null}
                  >
                    {busyAction === 'revoke'
                      ? t('exportConnectRevoking')
                      : t('exportConnectRevoke')}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
