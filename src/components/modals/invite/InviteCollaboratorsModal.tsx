'use client';
/**
 * Map toolbar's "Share" button, made functional (roadmap 8.9,
 * requirements.md §1.5): generates a real invite link an admin can copy and
 * send, and lists/revokes the organization's pending invitations. No email is
 * sent — the backend never persists the raw token, only its hash, so the
 * generated link is shown exactly once, right after creation.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'motion/react';
import { X, Check, Copy, Trash2 } from 'lucide-react';
import { useModalStore } from '@/store/useModalStore';
import { useAuthStore } from '@/store/useAuthStore';
import {
  createInvitation,
  listInvitations,
  revokeInvitation,
  type Invitation,
  type InvitationRole,
} from '@/services/invitations.service';
import { ApiError } from '@/lib/api-client';
import { useDialogMotion } from '@/hooks/useDialogMotion';
import AccessRestricted from '@/components/ui/AccessRestricted';
import styles from './InviteCollaboratorsModal.module.scss';

export default function InviteCollaboratorsModal() {
  const activeModal = useModalStore((s) => s.activeModal);
  const isOpen = activeModal === 'invite-collaborators';

  // Shell/content split (F9.7): AnimatePresence stays mounted so the exit
  // transition still plays, while the content below mounts fresh on each open.
  // Its initial state is then the state the modal should open in, which is what
  // the on-open effect used to have to arrange after the first render.
  return <AnimatePresence>{isOpen && <InviteCollaboratorsModalContent />}</AnimatePresence>;
}

function InviteCollaboratorsModalContent() {
  const t = useTranslations('invitar');
  const close = useModalStore((s) => s.close);

  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InvitationRole>('member');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [justCreated, setJustCreated] = useState<Invitation | null>(null);
  const [copied, setCopied] = useState(false);

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  // Starts loading only when there is going to be a fetch: a non-admin sees
  // the access-restricted panel instead of the list, and a spinner that never
  // resolves is exactly what a blanket `useState(true)` would give them.
  const [loadingList, setLoadingList] = useState(isAdmin);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const { overlay, panel } = useDialogMotion();

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    listInvitations()
      .then((list) => {
        if (!cancelled) setInvitations(list);
      })
      .catch(() => {
        if (!cancelled) setInvitations([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) emailInputRef.current?.focus();
  }, [isAdmin]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close]);

  const handleClose = () => {
    setJustCreated(null);
    setCreateError('');
    setEmail('');
    close();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    setCreating(true);
    setCreateError('');
    setJustCreated(null);
    try {
      const invitation = await createInvitation({ email: trimmed, role });
      setJustCreated(invitation);
      setInvitations((prev) => [invitation, ...prev]);
      setEmail('');
      setRole('member');
    } catch (err) {
      setCreateError(
        err instanceof ApiError && err.status === 409 ? t('errorAlreadyMember') : t('errorGeneric'),
      );
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!justCreated?.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(justCreated.inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission denied — the link is still visible to copy manually.
    }
  };

  const handleRevoke = async (id: string) => {
    setRevokingId(id);
    try {
      await revokeInvitation(id);
      setInvitations((prev) =>
        prev.map((inv) => (inv.id === id ? { ...inv, status: 'revoked' } : inv)),
      );
    } catch {
      // Left as-is on failure; the row still shows its previous status.
    } finally {
      setRevokingId(null);
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
          {!isAdmin ? (
            <AccessRestricted title={t('forbiddenTitle')} message={t('forbiddenMessage')} />
          ) : (
            <>
              <p className={styles.intro}>{t('intro')}</p>

              <form className={styles['create-row']} onSubmit={handleCreate}>
                <input
                  ref={emailInputRef}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('emailPlaceholder')}
                  aria-label={t('emailAriaLabel')}
                  required
                />
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as InvitationRole)}
                  aria-label={t('roleAriaLabel')}
                >
                  <option value="member">{t('roleMember')}</option>
                  <option value="admin">{t('roleAdmin')}</option>
                </select>
                <button type="submit" disabled={creating || !email.trim()}>
                  {creating ? t('generating') : t('generate')}
                </button>
              </form>

              {createError && (
                <p className={styles.error} role="alert">
                  {createError}
                </p>
              )}

              {justCreated?.inviteUrl && (
                <div className={styles['link-panel']} role="status">
                  <p className={styles['link-panel__label']}>{t('linkReady')}</p>
                  <div className={styles['link-panel__row']}>
                    <input type="text" readOnly value={justCreated.inviteUrl} />
                    <button type="button" onClick={handleCopy} aria-label={t('copyLink')}>
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? t('copied') : t('copy')}
                    </button>
                  </div>
                </div>
              )}

              <div className={styles.list} role="list" aria-label={t('listAriaLabel')}>
                {loadingList ? (
                  <p className={styles.empty}>{t('loading')}</p>
                ) : invitations.length === 0 ? (
                  <p className={styles.empty}>{t('empty')}</p>
                ) : (
                  invitations.map((inv) => (
                    <div key={inv.id} className={styles.item} role="listitem">
                      <div className={styles.item__info}>
                        <span className={styles.item__email}>{inv.email}</span>
                        <span className={styles.item__meta}>
                          {inv.role === 'admin' ? t('roleAdmin') : t('roleMember')} ·{' '}
                          {inv.status === 'accepted'
                            ? t('statusAccepted')
                            : inv.status === 'revoked'
                              ? t('statusRevoked')
                              : inv.expired
                                ? t('statusExpired')
                                : t('statusPending')}
                        </span>
                      </div>
                      {inv.status === 'pending' && !inv.expired && (
                        <button
                          type="button"
                          className={styles.item__revoke}
                          onClick={() => handleRevoke(inv.id)}
                          disabled={revokingId === inv.id}
                          aria-label={t('revoke', { email: inv.email })}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
