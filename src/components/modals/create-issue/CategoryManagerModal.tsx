'use client';
/**
 * Nested sub-modal for managing custom incident categories. Opened from within
 * {@link IssueForm}; closing it reopens the create-issue modal rather than
 * dismissing the whole flow. Categories added here go into {@link useCategoriesStore}
 * and become immediately selectable in the form's real category catalog.
 */
import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'motion/react';
import { X, Trash2 } from 'lucide-react';
import { useModalStore } from '@/store/useModalStore';
import { useCategoriesStore } from '@/store/useCategoriesStore';
import { useDialogMotion } from '@/hooks/useDialogMotion';
import styles from './CategoryManagerModal.module.scss';

export default function CategoryManagerModal() {
  const t = useTranslations('createIssue');
  const activeModal = useModalStore((s) => s.activeModal);
  const open = useModalStore((s) => s.open);
  const isOpen = activeModal === 'category-manager';

  const categories = useCategoriesStore((s) => s.customTypes);
  const addCategory = useCategoriesStore((s) => s.addCategory);
  const removeCategory = useCategoriesStore((s) => s.removeCategory);
  const [newName, setNewName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { overlay, panel } = useDialogMotion();

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        open('create-issue');
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, open]);

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    addCategory(trimmed);
    setNewName('');
    inputRef.current?.focus();
  };

  const handleDelete = (id: string) => removeCategory(id);

  const handleClose = () => open('create-issue');

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
          aria-modal="true"
          aria-label={t('categoryManager.ariaLabel')}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <motion.div className={styles.modal} variants={panel}>
            <div className={styles.header}>
              <h3>{t('categoryManager.title')}</h3>
              <button
                type="button"
                className={styles.close}
                onClick={handleClose}
                aria-label={t('categoryManager.close')}
              >
                <X size={16} />
              </button>
            </div>

            <div className={styles.body}>
              <div className={styles['add-row']}>
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={t('categoryManager.newCategoryPlaceholder')}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAdd();
                    }
                  }}
                  aria-label={t('categoryManager.newCategoryAriaLabel')}
                />
                <button type="button" onClick={handleAdd} disabled={!newName.trim()}>
                  {t('categoryManager.add')}
                </button>
              </div>

              <div
                className={styles.list}
                role="list"
                aria-label={t('categoryManager.listAriaLabel')}
              >
                {categories.length === 0 ? (
                  <p className={styles.empty}>{t('categoryManager.empty')}</p>
                ) : (
                  categories.map((cat) => (
                    <div key={cat.id} className={styles.item} role="listitem">
                      <span className={styles.item__name}>{cat.name}</span>
                      <button
                        type="button"
                        className={styles.item__delete}
                        onClick={() => handleDelete(cat.id)}
                        aria-label={t('categoryManager.deleteCategory', { name: cat.name })}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
