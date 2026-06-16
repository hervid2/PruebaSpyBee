'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { login } from '@/services/auth.service';
import { useAuthStore } from '@/store/useAuthStore';
import styles from './Login.module.scss';

const loginSchema = z.object({
  email: z.string().email('Introduce un email válido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const loginAction = useAuthStore((s) => s.login);
  const [serverError, setServerError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginForm) => {
    setServerError('');
    try {
      const { user, token } = await login(data.email, data.password);
      loginAction(user, token);
      router.push('/mapa');
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    }
  };

  return (
    <div className={styles.login} role="main">
      <div className={styles.login__card}>
        <div className={styles.login__header}>
          <span className={styles.login__logo} aria-label="Spybee">
            Spybee
          </span>
          <h1 className={styles.login__title}>Gestión de Incidencias</h1>
          <p className={styles.login__subtitle}>Inicia sesión para continuar</p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className={styles.login__form}
          noValidate
          aria-label="Formulario de inicio de sesión"
        >
          <div className={styles.login__field}>
            <label htmlFor="email" className={styles.login__label}>
              Email
            </label>
            <input
              id="email"
              type="email"
              className={`${styles.login__input} ${errors.email ? styles['login__input--error'] : ''}`}
              placeholder="usuario@empresa.com"
              autoComplete="email"
              aria-describedby={errors.email ? 'email-error' : undefined}
              aria-invalid={!!errors.email}
              {...register('email')}
            />
            {errors.email && (
              <span id="email-error" className={styles.login__error} role="alert">
                {errors.email.message}
              </span>
            )}
          </div>

          <div className={styles.login__field}>
            <label htmlFor="password" className={styles.login__label}>
              Contraseña
            </label>
            <div className={styles.login__password_wrap}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className={`${styles.login__input} ${errors.password ? styles['login__input--error'] : ''}`}
                placeholder="••••••••"
                autoComplete="current-password"
                aria-describedby={errors.password ? 'password-error' : undefined}
                aria-invalid={!!errors.password}
                {...register('password')}
              />
              <button
                type="button"
                className={styles.login__eye_btn}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && (
              <span id="password-error" className={styles.login__error} role="alert">
                {errors.password.message}
              </span>
            )}
          </div>

          {serverError && (
            <div className={styles.login__server_error} role="alert" aria-live="assertive">
              {serverError}
            </div>
          )}

          <button
            type="submit"
            className={styles.login__submit}
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? 'Iniciando sesión…' : 'Iniciar sesión'}
          </button>
        </form>

        <div className={styles.login__demo} aria-label="Credenciales de demostración">
          <p className={styles.login__demo_title}>Credenciales de demo</p>
          <div className={styles.login__demo_item}>
            <span className={styles.login__demo_label}>Spybee</span>
            <code className={styles.login__demo_code}>julian.lozano@spybee.io / spybee123</code>
          </div>
          <div className={styles.login__demo_item}>
            <span className={styles.login__demo_label}>Constructora</span>
            <code className={styles.login__demo_code}>
              mateo.soto@constructora.com / constructora123
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}
