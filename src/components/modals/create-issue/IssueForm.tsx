'use client';
/**
 * The create-incident form itself. Orchestrates React Hook Form + Zod validation
 * and the custom field widgets (tags, people, location, files), then maps the
 * form values to a {@link CreateIncidentDto}, calls the service and pushes the
 * resulting incident into the issues store. Reference data (types, projects,
 * tags, teammates) is fetched from the real backend when the form mounts —
 * it's unmounted/remounted every time the modal opens (CreateIssueModal.tsx),
 * so this stays reasonably fresh without needing its own cache invalidation.
 */
import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch, Controller, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { useTranslations } from 'next-intl';
import { useIssuesStore } from '@/store/useIssuesStore';
import { useModalStore } from '@/store/useModalStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useCategoriesStore } from '@/store/useCategoriesStore';
import { createIncident } from '@/services/incident-mutations.service';
import { getIncidentTypes, getProjects, getTags, getOrgMembers } from '@/services/catalogs.service';
import { uploadMedia } from '@/services/media.service';
import { createIssueFormSchema, type IssueFormValues } from '@/lib/validators/issue-form.schema';
import TagTreeSelect from './TagTreeSelect';
import UserMultiSelect from './UserMultiSelect';
import CategoryManagerModal from './CategoryManagerModal';
import LocationPicker from './LocationPicker';
import FileUploader from './FileUploader';
import type { IncidentType, Media, Project, Tag, UserRef } from '@/domain/models';
import styles from './IssueForm.module.scss';

const TODAY = format(new Date(), 'yyyy-MM-dd');

interface Catalogs {
  types: IncidentType[];
  projects: Project[];
  tags: Tag[];
  members: UserRef[];
}

interface Props {
  onClose: () => void;
}

export default function IssueForm({ onClose }: Props) {
  const t = useTranslations('createIssue');
  const tValidation = useTranslations('validation');
  const schema = useMemo(() => createIssueFormSchema(tValidation), [tValidation]);
  const addIncident = useIssuesStore((s) => s.addIncident);
  const updateIncidentInStore = useIssuesStore((s) => s.updateIncident);
  const openModal = useModalStore((s) => s.open);
  const authHydrated = useAuthStore((s) => s.hydrated);
  const customTypes = useCategoriesStore((s) => s.customTypes);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [uploadStatuses, setUploadStatuses] = useState<Map<File, Media['status']>>(new Map());
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadPartialError, setUploadPartialError] = useState(false);
  // Guards against a double-submit re-creating the incident: once creation
  // succeeds, isSubmitting goes back to false after the upload pass settles
  // (even on a partial failure), so the submit button would otherwise be
  // clickable again.
  const [createdIncidentId, setCreatedIncidentId] = useState<string | null>(null);

  const [catalogs, setCatalogs] = useState<Catalogs | null>(null);
  const [catalogsError, setCatalogsError] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  // Waits for AuthBootstrap's hydrateFromCookie to settle before firing: the
  // modal can open (and this effect run) before that async call has put an
  // access token in the store, and unlike a submit/upload — which only ever
  // happen after a user has already interacted with a hydrated page — this
  // fetch runs on mount, right after the fastest possible first paint.
  useEffect(() => {
    if (!authHydrated) return;
    let cancelled = false;
    Promise.all([getIncidentTypes(), getProjects(), getTags(), getOrgMembers()])
      .then(([types, projects, tags, members]) => {
        if (!cancelled) setCatalogs({ types, projects, tags, members });
      })
      .catch(() => {
        if (!cancelled) setCatalogsError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [authHydrated]);

  const typeCatalog = [...(catalogs?.types ?? []), ...customTypes];

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<IssueFormValues>({
    resolver: zodResolver(schema) as Resolver<IssueFormValues>,
    defaultValues: {
      title: '',
      description: '',
      dueDate: '',
      typeId: '',
      projectId: '',
      priority: 'medium',
      tagIds: [],
      assigneeIds: [],
      observerIds: [],
      coordinates: null,
      locationDescription: null,
    },
  });

  // `useWatch` rather than `useForm`'s `watch()` (F9.7). Both subscribe to the
  // same two fields, but `watch` is a *function* returned by a hook, which the
  // React Compiler cannot memoize safely — so it bails out of compiling this
  // whole component ("Compilation Skipped: Use of incompatible library"), the
  // one warning of the thirteen that costs something beyond style. `useWatch`
  // is the subscription form of the same API and returns values, not a getter.
  const coordinates = useWatch({ control, name: 'coordinates' });
  const locationDescription = useWatch({ control, name: 'locationDescription' });

  // Resolve selected ids back to full objects, build the DTO, persist, then
  // (if any files were attached) upload them before closing — the modal
  // stays open through the upload pass so FileUploader can show progress.
  const onSubmit = async (data: IssueFormValues) => {
    if (!catalogs || createdIncidentId) return;
    setSubmitError(false);

    const type = typeCatalog.find((ty) => ty.id === data.typeId)!;
    const project = catalogs.projects.find((p) => p.id === data.projectId)!;
    const assignees = catalogs.members.filter((u) => (data.assigneeIds ?? []).includes(u.id));
    const observers = catalogs.members.filter((u) => (data.observerIds ?? []).includes(u.id));
    const tags = catalogs.tags.filter((tg) => (data.tagIds ?? []).includes(tg.id));

    let incident;
    try {
      incident = await createIncident(
        {
          title: data.title,
          description: data.description,
          type,
          priority: data.priority,
          dueDate: data.dueDate,
          assignees,
          observers,
          tags,
          coordinates: data.coordinates ?? null,
          locationDescription: data.locationDescription ?? null,
          media: mediaFiles,
        },
        project,
      );
    } catch {
      setSubmitError(true);
      return;
    }

    addIncident(incident);
    setCreatedIncidentId(incident.id);

    if (mediaFiles.length === 0) {
      onClose();
      return;
    }

    setUploadingMedia(true);
    setUploadStatuses(new Map(mediaFiles.map((f) => [f, 'pending' as const])));

    const results = await Promise.allSettled(
      mediaFiles.map((file) => uploadMedia(incident.id, file)),
    );

    const uploaded: Media[] = [];
    const finalStatuses = new Map<File, Media['status']>();
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        uploaded.push(result.value);
        finalStatuses.set(mediaFiles[i], 'uploaded');
      } else {
        finalStatuses.set(mediaFiles[i], 'error');
      }
    });
    setUploadStatuses(finalStatuses);
    setUploadingMedia(false);

    if (uploaded.length > 0) {
      updateIncidentInStore({ ...incident, media: uploaded });
    }

    // All attachments uploaded cleanly — close like before. On a partial
    // failure, stay open so the per-file error badges (FileUploader) and the
    // summary message below are actually visible; the incident itself is
    // already created either way, so there's nothing left to submit.
    if (uploaded.length === mediaFiles.length) {
      onClose();
    } else {
      setUploadPartialError(true);
    }
  };

  if (catalogsError) {
    return (
      <div className={styles.body}>
        <p className={styles.error} role="alert">
          {t('form.catalogsError')}
        </p>
      </div>
    );
  }

  if (!catalogs) {
    return (
      <div className={styles.body}>
        <p aria-live="polite">{t('form.loadingCatalogs')}</p>
      </div>
    );
  }

  return (
    <form
      className={styles.form}
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      aria-label={t('form.ariaLabel')}
    >
      <div className={styles.body}>
        {/* ── Título ──────────────────────────────────────────────────────────── */}
        <div className={styles.field}>
          <label htmlFor="issue-title" className={`${styles.label} ${styles['label--required']}`}>
            {t('form.titleLabel')}
          </label>
          <input
            id="issue-title"
            type="text"
            className={`${styles.input} ${errors.title ? styles['input--error'] : ''}`}
            placeholder={t('form.titlePlaceholder')}
            aria-describedby={errors.title ? 'issue-title-error' : undefined}
            aria-invalid={!!errors.title}
            maxLength={120}
            {...register('title')}
          />
          {errors.title && (
            <p id="issue-title-error" className={styles.error} role="alert">
              {errors.title.message}
            </p>
          )}
        </div>

        {/* ── Descripción ─────────────────────────────────────────────────────── */}
        <div className={styles.field}>
          <label
            htmlFor="issue-description"
            className={`${styles.label} ${styles['label--required']}`}
          >
            {t('form.descriptionLabel')}
          </label>
          <textarea
            id="issue-description"
            className={`${styles.textarea} ${errors.description ? styles['textarea--error'] : ''}`}
            placeholder={t('form.descriptionPlaceholder')}
            aria-describedby={errors.description ? 'issue-desc-error' : undefined}
            aria-invalid={!!errors.description}
            maxLength={1000}
            {...register('description')}
          />
          {errors.description && (
            <p id="issue-desc-error" className={styles.error} role="alert">
              {errors.description.message}
            </p>
          )}
        </div>

        {/* ── Fecha de vencimiento ────────────────────────────────────────────── */}
        <div className={styles.field}>
          <label
            htmlFor="issue-due-date"
            className={`${styles.label} ${styles['label--required']}`}
          >
            {t('form.dueDateLabel')}
          </label>
          <input
            id="issue-due-date"
            type="date"
            className={`${styles.input} ${errors.dueDate ? styles['input--error'] : ''}`}
            min={TODAY}
            aria-describedby={errors.dueDate ? 'issue-due-error' : undefined}
            aria-invalid={!!errors.dueDate}
            {...register('dueDate')}
          />
          {errors.dueDate && (
            <p id="issue-due-error" className={styles.error} role="alert">
              {errors.dueDate.message}
            </p>
          )}
        </div>

        {/* ── Categoría ───────────────────────────────────────────────────────── */}
        <div className={styles.field}>
          <label htmlFor="issue-type" className={`${styles.label} ${styles['label--required']}`}>
            {t('form.categoryLabel')}
          </label>
          <div className={styles['field-row']}>
            <div className={styles.field}>
              <select
                id="issue-type"
                className={`${styles.select} ${errors.typeId ? styles['select--error'] : ''}`}
                aria-describedby={errors.typeId ? 'issue-type-error' : undefined}
                aria-invalid={!!errors.typeId}
                {...register('typeId')}
              >
                <option value="">{t('form.categoryPlaceholder')}</option>
                {typeCatalog.map((ty) => (
                  <option key={ty.id} value={ty.id}>
                    {ty.name}
                  </option>
                ))}
              </select>
              {errors.typeId && (
                <p id="issue-type-error" className={styles.error} role="alert">
                  {errors.typeId.message}
                </p>
              )}
            </div>
            <button
              type="button"
              className={styles['manage-btn']}
              onClick={() => openModal('category-manager')}
            >
              {t('form.manageCategoriesButton')}
            </button>
          </div>
        </div>

        {/* ── Proyecto ────────────────────────────────────────────────────────── */}
        <div className={styles.field}>
          <label htmlFor="issue-project" className={`${styles.label} ${styles['label--required']}`}>
            {t('form.projectLabel')}
          </label>
          <select
            id="issue-project"
            className={`${styles.select} ${errors.projectId ? styles['select--error'] : ''}`}
            aria-describedby={errors.projectId ? 'issue-project-error' : undefined}
            aria-invalid={!!errors.projectId}
            {...register('projectId')}
          >
            <option value="">{t('form.projectPlaceholder')}</option>
            {catalogs.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {errors.projectId && (
            <p id="issue-project-error" className={styles.error} role="alert">
              {errors.projectId.message}
            </p>
          )}
        </div>

        {/* ── Prioridad ───────────────────────────────────────────────────────── */}
        <div className={styles.field}>
          <label
            htmlFor="issue-priority"
            className={`${styles.label} ${styles['label--required']}`}
          >
            {t('form.priorityLabel')}
          </label>
          <select
            id="issue-priority"
            className={`${styles.select} ${errors.priority ? styles['select--error'] : ''}`}
            aria-invalid={!!errors.priority}
            {...register('priority')}
          >
            <option value="high">{t('form.priorityHigh')}</option>
            <option value="medium">{t('form.priorityMedium')}</option>
            <option value="low">{t('form.priorityLow')}</option>
          </select>
        </div>

        {/* ── Etiquetas ───────────────────────────────────────────────────────── */}
        <div className={styles.field}>
          <span className={styles.label}>{t('form.tagsLabel')}</span>
          <Controller
            name="tagIds"
            control={control}
            render={({ field }) => (
              <TagTreeSelect
                tags={catalogs.tags}
                selectedIds={field.value ?? []}
                onChange={field.onChange}
              />
            )}
          />
        </div>

        {/* ── Personas ────────────────────────────────────────────────────────── */}
        <p className={styles['section-label']}>{t('form.peopleSection')}</p>

        <div className={styles.field}>
          <span className={styles.label}>{t('form.assigneesLabel')}</span>
          <Controller
            name="assigneeIds"
            control={control}
            render={({ field }) => (
              <UserMultiSelect
                users={catalogs.members}
                selectedIds={field.value ?? []}
                onChange={field.onChange}
                placeholder={t('form.assigneesPlaceholder')}
                aria-label={t('form.assigneesAriaLabel')}
              />
            )}
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>{t('form.observersLabel')}</span>
          <Controller
            name="observerIds"
            control={control}
            render={({ field }) => (
              <UserMultiSelect
                users={catalogs.members}
                selectedIds={field.value ?? []}
                onChange={field.onChange}
                placeholder={t('form.observersPlaceholder')}
                aria-label={t('form.observersAriaLabel')}
              />
            )}
          />
        </div>

        {/* ── Ubicación ───────────────────────────────────────────────────────── */}
        <p className={styles['section-label']}>{t('form.locationSection')}</p>

        <div className={styles.field}>
          <LocationPicker
            value={coordinates ?? null}
            locationDescription={locationDescription ?? null}
            onChangeCoords={(coords) =>
              setValue('coordinates', coords, { shouldValidate: true, shouldDirty: true })
            }
            onChangeDescription={(desc) =>
              setValue('locationDescription', desc, { shouldDirty: true })
            }
          />
        </div>

        {/* ── Archivos adjuntos ────────────────────────────────────────────────── */}
        <p className={styles['section-label']}>{t('form.attachmentsSection')}</p>

        <div className={styles.field}>
          <FileUploader
            value={mediaFiles}
            onChange={setMediaFiles}
            statuses={uploadStatuses}
            uploading={uploadingMedia}
          />
        </div>

        {uploadingMedia && <p aria-live="polite">{t('form.uploadingAttachments')}</p>}
        {uploadPartialError && (
          <p className={styles.error} role="alert" aria-live="assertive">
            {t('form.uploadPartialError')}
          </p>
        )}
        {submitError && (
          <p className={styles.error} role="alert" aria-live="assertive">
            {t('form.submitError')}
          </p>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────────────── */}
      <div className={styles.footer}>
        <button type="button" className={styles['btn-cancel']} onClick={onClose}>
          {createdIncidentId ? t('form.close') : t('form.cancel')}
        </button>
        {!createdIncidentId && (
          <button type="submit" className={styles['btn-submit']} disabled={isSubmitting}>
            {isSubmitting ? t('form.submitting') : t('form.submit')}
          </button>
        )}
      </div>

      {/* CategoryManagerModal se renderiza aquí (sub-modal) */}
      <CategoryManagerModal />
    </form>
  );
}
