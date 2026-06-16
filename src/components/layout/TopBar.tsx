'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, Globe, LogOut } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import styles from './TopBar.module.scss';

interface TopBarProps {
  projectName?: string;
}

export default function TopBar({ projectName = 'Proyecto Onboarding' }: TopBarProps) {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  // Avoid SSR hydration mismatch — auth state is cookie-based, only available client-side
  useEffect(() => setMounted(true), []);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const initials =
    mounted && user
      ? user.name
          .split(' ')
          .map((w) => w[0])
          .join('')
          .slice(0, 2)
          .toUpperCase()
      : 'U';
  const displayName = mounted && user ? user.name : 'Usuario';
  const displayRole = mounted && user ? user.role : 'Superadmin';

  return (
    <header className={styles.topbar} role="banner">
      <Link href="/" className={styles.topbar__logo} aria-label="Spybee - Inicio">
        <span className={styles['topbar__logo-text']}>Spybee</span>
      </Link>

      <span className={styles.topbar__title} aria-live="polite">
        {projectName}
      </span>

      <div className={styles.topbar__actions}>
        <button
          className={styles['topbar__lang-selector']}
          aria-label="Seleccionar idioma"
          type="button"
        >
          <Globe size={14} aria-hidden="true" />
          <span>ES</span>
          <ChevronDown size={12} aria-hidden="true" />
        </button>

        <button
          className={styles.topbar__user}
          aria-label={`Usuario: ${displayName} — ${displayRole}`}
          type="button"
        >
          <div className={styles['topbar__user-avatar']} aria-hidden="true">
            {initials}
          </div>
          <div className={styles['topbar__user-info']}>
            <span className={styles['topbar__user-name']}>{displayName}</span>
            <span className={styles['topbar__user-role']}>{displayRole}</span>
          </div>
          <ChevronDown size={14} aria-hidden="true" style={{ color: 'rgba(255,255,255,0.5)' }} />
        </button>

        {mounted && isAuthenticated && (
          <button
            className={styles.topbar__logout}
            onClick={handleLogout}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            type="button"
          >
            <LogOut size={16} aria-hidden="true" />
          </button>
        )}

        <button className={styles.topbar__help} aria-label="Ayuda" type="button">
          ?
        </button>
      </div>
    </header>
  );
}
