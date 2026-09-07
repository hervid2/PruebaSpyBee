'use client';
/**
 * Public accept-invitation screen (roadmap 8.9). Previews the token first
 * (org name, role, prefilled email), then lets the invitee set their own
 * name/password; a successful accept auto-logs them in exactly like the real
 * login page does (getMe + useAuthStore.login), then redirects to /mapa.
 */
import { use, useEffect, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff } from 'lucide-react';
import {
  previewInvitation,
  acceptInvitation,
  type InvitationPreview,
} from '@/services/invitations.service';
import { getMe } from '@/services/auth.service';
import { useAuthStore } from '@/store/useAuthStore';
import { ApiError } from '@/lib/api-client';
import FlyIcon from '@/components/ui/FlyIcon';
import {
  createAcceptInvitationFormSchema,
  type AcceptInvitationFormValues,
} from '@/lib/validators/invitation.schema';
import styles from './Invitar.module.scss';

type PreviewState = 'loading' | 'ready' | 'notFound' | 'gone';

export default function InvitarAceptarPage({ params }: { params: Promise<{ token: string }> }) {
  // `params` is a promise since next@16, in Client Components too (F9.5).
  // The hand-written type here used to say otherwise, which is why nothing
  // failed to compile: `params.token` would simply have been `undefined` at
  // runtime and every invitation link would have previewed as "not found".
  const { token } = use(params);
  const t = useTranslations('invitar');
  const router = useRouter();
  const loginAction = useAuthStore((s) => s.login);

  const [previewState, setPreviewState] = useState<PreviewState>('loading');
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [serverError, setServerError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    let cancelled = false;
    previewInvitation(token)
      .then((data) => {
        if (cancelled) return;
        setPreview(data);
        setPreviewState('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPreviewState(err instanceof ApiError && err.status === 410 ? 'gone' : 'notFound');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const schema = createAcceptInvitationFormSchema(t);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AcceptInvitationFormValues>({
    resolver: zodResolver(schema) as Resolver<AcceptInvitationFormValues>,
  });

  const onSubmit = async (data: AcceptInvitationFormValues) => {
    setServerError('');
    try {
      const { accessToken } = await acceptInvitation(token, {
        name: data.name,
        password: data.password,
      });
      const user = await getMe(accessToken);
      loginAction(user, accessToken);
      router.push('/mapa');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setServerError(t('submitErrorConflict'));
      } else if (err instanceof ApiError && (err.status === 404 || err.status === 410)) {
        setServerError(t('submitErrorGone'));
      } else {
        setServerError(t('submitErrorGeneric'));
      }
    }
  };

  if (previewState === 'loading') {
    return (
      <div className={styles.invitar} role="main">
        <div className={styles.invitar__card}>
          <p className={styles.invitar__status}>{t('previewLoading')}</p>
        </div>
      </div>
    );
  }

  if (previewState === 'notFound' || previewState === 'gone') {
    return (
      <div className={styles.invitar} role="main">
        <div className={styles.invitar__card}>
          <div className={styles.invitar__header}>
            <span className={styles.invitar__logo} aria-label="FlyWorkFlow">
              <FlyIcon size={28} />
              FlyWorkFlow
            </span>
            <h1 className={styles.invitar__title}>
              {previewState === 'notFound' ? t('previewNotFoundTitle') : t('previewGoneTitle')}
            </h1>
            <p className={styles.invitar__subtitle}>
              {previewState === 'notFound' ? t('previewNotFoundMessage') : t('previewGoneMessage')}
            </p>
          </div>
          <a href="/login" className={styles.invitar__submit}>
            {t('backToLogin')}
          </a>
        </div>
      </div>
    );
  }

  const roleLabel = preview?.role === 'admin' ? t('roleAdmin') : t('roleMember');

  return (
    <div className={styles.invitar} role="main">
      <div className={styles.invitar__card}>
        <div className={styles.invitar__header}>
          <span className={styles.invitar__logo} aria-label="FlyWorkFlow">
            <FlyIcon size={28} />
            FlyWorkFlow
          </span>
          <h1 className={styles.invitar__title}>{t('pageHeading')}</h1>
          <p className={styles.invitar__subtitle}>
            {t('pageSubtitle', { orgName: preview?.orgName ?? '', role: roleLabel })}
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className={styles.invitar__form}
          noValidate
          aria-label={t('pageHeading')}
        >
          <div className={styles.invitar__field}>
            <label htmlFor="invite-email" className={styles.invitar__label}>
              {t('labelEmail')}
            </label>
            <input
              id="invite-email"
              type="email"
              className={styles.invitar__input}
              value={preview?.email ?? ''}
              disabled
              readOnly
            />
          </div>

          <div className={styles.invitar__field}>
            <label htmlFor="invite-name" className={styles.invitar__label}>
              {t('labelName')}
            </label>
            <input
              id="invite-name"
              type="text"
              className={`${styles.invitar__input} ${errors.name ? styles['invitar__input--error'] : ''}`}
              placeholder={t('namePlaceholder')}
              autoComplete="name"
              aria-describedby={errors.name ? 'invite-name-error' : undefined}
              aria-invalid={!!errors.name}
              {...register('name')}
            />
            {errors.name && (
              <span id="invite-name-error" className={styles.invitar__error} role="alert">
                {errors.name.message}
              </span>
            )}
          </div>

          <div className={styles.invitar__field}>
            <label htmlFor="invite-password" className={styles.invitar__label}>
              {t('labelPassword')}
            </label>
            <div className={styles.invitar__password_wrap}>
              <input
                id="invite-password"
                type={showPassword ? 'text' : 'password'}
                className={`${styles.invitar__input} ${errors.password ? styles['invitar__input--error'] : ''}`}
                placeholder={t('passwordPlaceholder')}
                autoComplete="new-password"
                aria-describedby={errors.password ? 'invite-password-error' : undefined}
                aria-invalid={!!errors.password}
                {...register('password')}
              />
              <button
                type="button"
                className={styles.invitar__eye_btn}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t('hidePassword') : t('showPassword')}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && (
              <span id="invite-password-error" className={styles.invitar__error} role="alert">
                {errors.password.message}
              </span>
            )}
          </div>

          <div className={styles.invitar__field}>
            <label htmlFor="invite-confirm-password" className={styles.invitar__label}>
              {t('labelConfirmPassword')}
            </label>
            <input
              id="invite-confirm-password"
              type={showPassword ? 'text' : 'password'}
              className={`${styles.invitar__input} ${errors.confirmPassword ? styles['invitar__input--error'] : ''}`}
              placeholder={t('passwordPlaceholder')}
              autoComplete="new-password"
              aria-describedby={
                errors.confirmPassword ? 'invite-confirm-password-error' : undefined
              }
              aria-invalid={!!errors.confirmPassword}
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <span
                id="invite-confirm-password-error"
                className={styles.invitar__error}
                role="alert"
              >
                {errors.confirmPassword.message}
              </span>
            )}
          </div>

          {serverError && (
            <div className={styles.invitar__server_error} role="alert" aria-live="assertive">
              {serverError}
            </div>
          )}

          <button
            type="submit"
            className={styles.invitar__submit}
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? t('submitting') : t('submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
