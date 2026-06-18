'use client';
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useModalStore } from '@/store/useModalStore';
import IssueForm from './IssueForm';
import styles from './CreateIssueModal.module.scss';

export default function CreateIssueModal() {
  const activeModal = useModalStore((s) => s.activeModal);
  const close = useModalStore((s) => s.close);
  const dialogRef = useRef<HTMLDivElement>(null);
  // Stays mounted while the category-manager sub-modal is active, since it renders
  // inside IssueForm and would otherwise unmount along with this parent.
  const isOpen = activeModal === 'create-issue' || activeModal === 'category-manager';

  // Focus trap and Esc key handling
  useEffect(() => {
    if (!isOpen) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusableSelectors =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    const focusableEls = Array.from(
      dialog.querySelectorAll<HTMLElement>(focusableSelectors),
    ).filter((el) => !el.hasAttribute('disabled'));

    const first = focusableEls[0];
    const last = focusableEls[focusableEls.length - 1];

    first?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        return;
      }
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, close]);

  // Prevent background scroll
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-issue-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className={styles.modal} ref={dialogRef}>
        <div className={styles.header}>
          <h2 id="create-issue-title" className={styles.header__title}>
            Crear Incidencia
          </h2>
          <button
            className={styles.header__close}
            type="button"
            onClick={close}
            aria-label="Cerrar modal"
          >
            <X size={18} />
          </button>
        </div>

        <IssueForm onClose={close} />
      </div>
    </div>
  );
}
