'use client';
import { useForm, Controller, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { useIssuesStore } from '@/store/useIssuesStore';
import { useModalStore } from '@/store/useModalStore';
import { createIncident } from '@/services/incidents.service';
import { issueFormSchema, type IssueFormValues } from '@/lib/validators/issue-form.schema';
import { INCIDENT_TYPES } from '@/lib/constants/incident-types';
import { MOCK_USERS } from '@/lib/constants/mock-users';
import TagTreeSelect from './TagTreeSelect';
import UserMultiSelect from './UserMultiSelect';
import CategoryManagerModal from './CategoryManagerModal';
import type { Tag } from '@/domain/models';
import styles from './IssueForm.module.scss';

// Static flat tags from the mock data
const MOCK_TAGS: Tag[] = [
  { id: '4bf3f690ae021229ec15f203', name: 'Reproceso', color: '#EF4444' },
  { id: '2a544044d7c705a56d0cf6c5', name: 'Acabados', color: '#6366F1' },
  { id: '86207f931475a6ec04908f00', name: 'Urgente', color: '#F59E0B' },
  { id: '95ef91272c28455168120ac3', name: 'Humedad', color: '#3B82F6' },
  { id: '132cd775ccc64acfd82582cc', name: 'Cliente', color: '#EC4899' },
  { id: 'a0314e3a97dac785a2dd5a6f', name: 'Seguridad', color: '#10B981' },
  { id: '835ac9eaf409e5d275108498', name: 'Calidad', color: '#8B5CF6' },
  { id: 'd1fa90ad0559f69ec34319e1', name: 'Garantía', color: '#14B8A6' },
];

const MOCK_OWNER = {
  id: 'spybee_u1',
  name: 'Julian Lozano',
  email: 'julian.lozano@spybee.io',
  avatarUrl: 'https://i.pravatar.cc/150?u=julian.lozano',
};

const MOCK_PROJECT = { id: 'proj_onboarding', name: 'Proyecto Onboarding' };

const TODAY = format(new Date(), 'yyyy-MM-dd');

interface Props {
  onClose: () => void;
}

export default function IssueForm({ onClose }: Props) {
  const addIncident = useIssuesStore((s) => s.addIncident);
  const openModal = useModalStore((s) => s.open);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<IssueFormValues>({
    resolver: zodResolver(issueFormSchema) as Resolver<IssueFormValues>,
    defaultValues: {
      title: '',
      description: '',
      dueDate: '',
      typeId: '',
      priority: 'medium',
      tagIds: [],
      assigneeIds: [],
      observerIds: [],
      coordinates: null,
      locationDescription: null,
    },
  });

  const onSubmit = async (data: IssueFormValues) => {
    const type = INCIDENT_TYPES.find((t) => t.id === data.typeId)!;
    const assignees = MOCK_USERS.filter((u) => (data.assigneeIds ?? []).includes(u.id));
    const observers = MOCK_USERS.filter((u) => (data.observerIds ?? []).includes(u.id));
    const tags = MOCK_TAGS.filter((t) => (data.tagIds ?? []).includes(t.id));

    const incident = await createIncident(
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
        media: [],
      },
      MOCK_OWNER,
      MOCK_PROJECT,
    );

    addIncident(incident);
    reset();
    onClose();
  };

  return (
    <form
      className={styles.form}
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      aria-label="Formulario de creación de incidencia"
    >
      <div className={styles.body}>
        {/* ── Título ──────────────────────────────────────────────────────────── */}
        <div className={styles.field}>
          <label htmlFor="issue-title" className={`${styles.label} ${styles['label--required']}`}>
            Título
          </label>
          <input
            id="issue-title"
            type="text"
            className={`${styles.input} ${errors.title ? styles['input--error'] : ''}`}
            placeholder="Describe brevemente la incidencia"
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
            Descripción
          </label>
          <textarea
            id="issue-description"
            className={`${styles.textarea} ${errors.description ? styles['textarea--error'] : ''}`}
            placeholder="Detalla la incidencia encontrada"
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
            Fecha de vencimiento
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
            Categoría
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
                <option value="">Seleccionar categoría...</option>
                {INCIDENT_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
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
              Gestionar categorías
            </button>
          </div>
        </div>

        {/* ── Prioridad ───────────────────────────────────────────────────────── */}
        <div className={styles.field}>
          <label
            htmlFor="issue-priority"
            className={`${styles.label} ${styles['label--required']}`}
          >
            Prioridad
          </label>
          <select
            id="issue-priority"
            className={`${styles.select} ${errors.priority ? styles['select--error'] : ''}`}
            aria-invalid={!!errors.priority}
            {...register('priority')}
          >
            <option value="high">Alta</option>
            <option value="medium">Media</option>
            <option value="low">Baja</option>
          </select>
        </div>

        {/* ── Etiquetas ───────────────────────────────────────────────────────── */}
        <div className={styles.field}>
          <span className={styles.label}>Etiquetas</span>
          <Controller
            name="tagIds"
            control={control}
            render={({ field }) => (
              <TagTreeSelect
                tags={MOCK_TAGS}
                selectedIds={field.value ?? []}
                onChange={field.onChange}
              />
            )}
          />
        </div>

        {/* ── Asignados ───────────────────────────────────────────────────────── */}
        <p className={styles['section-label']}>Personas</p>

        <div className={styles.field}>
          <span className={styles.label}>Asignados</span>
          <Controller
            name="assigneeIds"
            control={control}
            render={({ field }) => (
              <UserMultiSelect
                users={MOCK_USERS}
                selectedIds={field.value ?? []}
                onChange={field.onChange}
                placeholder="Buscar asignado..."
                aria-label="Seleccionar asignados"
              />
            )}
          />
        </div>

        {/* ── Observadores ────────────────────────────────────────────────────── */}
        <div className={styles.field}>
          <span className={styles.label}>Observadores</span>
          <Controller
            name="observerIds"
            control={control}
            render={({ field }) => (
              <UserMultiSelect
                users={MOCK_USERS}
                selectedIds={field.value ?? []}
                onChange={field.onChange}
                placeholder="Buscar observador..."
                aria-label="Seleccionar observadores"
              />
            )}
          />
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────────────── */}
      <div className={styles.footer}>
        <button type="button" className={styles['btn-cancel']} onClick={onClose}>
          Cancelar
        </button>
        <button type="submit" className={styles['btn-submit']} disabled={isSubmitting}>
          {isSubmitting ? 'Creando...' : 'Crear'}
        </button>
      </div>

      {/* CategoryManagerModal se renderiza aquí (sub-modal) */}
      <CategoryManagerModal />
    </form>
  );
}
