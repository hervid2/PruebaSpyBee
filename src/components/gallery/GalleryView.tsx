'use client';
/**
 * `/galeria` content: a responsive grid of image/video attachments across
 * every incident in the org, newest first. Real server-side pagination, same
 * query-param-driven pattern as `/historial` and `/papelera`. Clicking a tile
 * opens a lightbox with the full-size media and its incident caption.
 */
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Image as ImageIcon, Video, X } from 'lucide-react';
import type { GalleryMediaItem } from '@/domain/models';
import styles from './GalleryView.module.scss';

interface Props {
  items: GalleryMediaItem[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Tiles loaded eagerly instead of lazily (F9.7). The grid is
 * `auto-fill, minmax(160px, 1fr)`, so a desktop content column fits six or
 * seven per row and the LCP element is always one of them. `next/image` lazy
 * loads by default, which means the largest thing on the page waited for the
 * intersection observer before its request even started; `priority` also
 * preloads it in the document head. Deliberately about one row and not more —
 * every priority image is a preload competing for the same connection, so
 * marking the whole grid would push the real LCP element back down the queue.
 * No layout shift either way: `.tile` is `aspect-ratio: 1`, so each cell is
 * sized before its image arrives.
 */
const EAGER_TILES = 6;

export default function GalleryView({ items, total, page, pageSize }: Props) {
  const t = useTranslations('galeria');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<GalleryMediaItem | null>(null);

  useEffect(() => {
    if (!selected) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSelected(null);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [selected]);

  function navigate(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(nextPage));
    router.push(`/galeria?${params.toString()}`);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section className={styles.section} aria-label={t('sectionAriaLabel')}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.header__title}>{t('pageTitle')}</h1>
          <p className={styles.header__subtitle}>{t('pageSubtitle')}</p>
        </div>
        <p className={styles.header__count}>
          {total === 0
            ? t('resultsEmpty')
            : t('resultsRange', {
                from: (page - 1) * pageSize + 1,
                to: Math.min(page * pageSize, total),
                total,
              })}
        </p>
      </div>

      {items.length === 0 ? (
        <p className={styles.empty}>{t('emptyGallery')}</p>
      ) : (
        <div className={styles.grid}>
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={styles.tile}
              onClick={() => setSelected(item)}
              aria-label={t('viewAriaLabel', { name: item.incident.title })}
            >
              <Image
                src={item.url}
                alt={item.incident.title}
                fill
                sizes="(max-width: 480px) 50vw, (max-width: 768px) 33vw, 200px"
                priority={index < EAGER_TILES}
                className={styles.tile__img}
              />
              <span className={styles.tile__typeBadge}>
                {item.type === 'video' ? <Video size={12} /> : <ImageIcon size={12} />}
              </span>
              <span className={styles.tile__caption}>
                <span className={styles.tile__code}>#{item.incident.sequenceId}</span>{' '}
                {item.incident.title}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className={styles.pagination} role="navigation" aria-label={t('paginationAriaLabel')}>
        <button
          className={styles.pagination__btn}
          onClick={() => navigate(page - 1)}
          disabled={page <= 1}
          aria-label={t('prevPageAriaLabel')}
        >
          <ChevronLeft size={16} />
        </button>
        <span className={styles.pagination__info}>
          {page} / {totalPages}
        </span>
        <button
          className={styles.pagination__btn}
          onClick={() => navigate(page + 1)}
          disabled={page >= totalPages}
          aria-label={t('nextPageAriaLabel')}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {selected && (
        <div
          className={styles.overlay}
          role="dialog"
          aria-modal
          aria-label={selected.incident.title}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <div className={styles.lightbox}>
            <button
              type="button"
              className={styles.lightbox__close}
              onClick={() => setSelected(null)}
              aria-label={t('lightboxCloseAriaLabel')}
            >
              <X size={20} />
            </button>
            <div className={styles.lightbox__imgWrap}>
              <Image
                src={selected.url}
                alt={selected.incident.title}
                fill
                sizes="90vw"
                className={styles.lightbox__img}
              />
            </div>
            <div className={styles.lightbox__meta}>
              <div className={styles.lightbox__metaRow}>
                <span className={styles.lightbox__metaLabel}>{t('metaIncident')}</span>
                <span>
                  #{selected.incident.sequenceId} — {selected.incident.title}
                </span>
              </div>
              <div className={styles.lightbox__metaRow}>
                <span className={styles.lightbox__metaLabel}>{t('metaProject')}</span>
                <span>{selected.incident.project.name}</span>
              </div>
              <div className={styles.lightbox__metaRow}>
                <span className={styles.lightbox__metaLabel}>{t('metaDate')}</span>
                <span>
                  {format(new Date(selected.createdAt), "d MMM yyyy, HH:mm'h'", { locale: es })}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
