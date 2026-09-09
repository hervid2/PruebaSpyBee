'use client';
/**
 * Global top bar: brand, current project name, language switcher, the user menu
 * and the logout action. Reads the session from the auth store and gates
 * user-specific UI behind `useIsHydrated` to keep SSR and client markup in sync.
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronDown, Globe, LogOut } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useLocaleStore } from '@/store/useLocaleStore';
import { useIsHydrated } from '@/hooks/useIsHydrated';
import type { Locale } from '@/i18n/messages';
import FlyIcon from '@/components/ui/FlyIcon';
import NotificationsBell from './NotificationsBell';
import styles from './TopBar.module.scss';

interface TopBarProps {
  projectName?: string;
}

export default function TopBar({ projectName = 'Proyecto Onboarding' }: TopBarProps) {
  const t = useTranslations('topbar');
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);

  // Avoid SSR hydration mismatch — auth state is cookie-based, only available client-side
  const mounted = useIsHydrated();

  useEffect(() => {
    if (!langMenuOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setLangMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [langMenuOpen]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  function selectLocale(next: Locale) {
    setLocale(next);
    setLangMenuOpen(false);
  }

  const initials =
    mounted && user
      ? user.name
          .split(' ')
          .map((w) => w[0])
          .join('')
          .slice(0, 2)
          .toUpperCase()
      : 'U';
  const displayName = mounted && user ? user.name : t('defaultUser');
  const displayRole = mounted && user ? user.role : 'Superadmin';
  const avatarUrl = mounted && user ? user.avatarUrl : undefined;

  return (
    <header className={styles.topbar} role="banner">
      <Link href="/" className={styles.topbar__logo} aria-label={t('home')}>
        <span className={styles['topbar__logo-text']}>FlyWorkFlow</span>
      </Link>

      <div className={styles.topbar__title} aria-live="polite">
        <span>{projectName}</span>
        <FlyIcon size={22} />
      </div>

      <div className={styles.topbar__actions}>
        <div className={styles['topbar__lang-wrapper']} ref={langMenuRef}>
          <button
            className={styles['topbar__lang-selector']}
            aria-label={t('selectLanguage')}
            aria-haspopup="listbox"
            aria-expanded={langMenuOpen}
            type="button"
            onClick={() => setLangMenuOpen((o) => !o)}
          >
            <Globe size={14} aria-hidden="true" />
            <span>{locale.toUpperCase()}</span>
            <ChevronDown size={12} aria-hidden="true" />
          </button>
          {langMenuOpen && (
            <ul
              className={styles['topbar__lang-menu']}
              role="listbox"
              aria-label={t('selectLanguage')}
            >
              <li role="option" aria-selected={locale === 'es'}>
                <button type="button" onClick={() => selectLocale('es')}>
                  {t('spanish')}
                </button>
              </li>
              <li role="option" aria-selected={locale === 'en'}>
                <button type="button" onClick={() => selectLocale('en')}>
                  {t('english')}
                </button>
              </li>
            </ul>
          )}
        </div>

        {mounted && isAuthenticated && <NotificationsBell />}

        <button
          className={styles.topbar__user}
          aria-label={t('user', { name: displayName, role: displayRole })}
          type="button"
        >
          <div className={styles['topbar__user-avatar']} aria-hidden="true">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" width={36} height={36} />
            ) : (
              initials
            )}
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
            aria-label={t('logout')}
            title={t('logout')}
            type="button"
          >
            <LogOut size={16} aria-hidden="true" />
          </button>
        )}

        <button className={styles.topbar__help} aria-label={t('help')} type="button">
          ?
        </button>
      </div>
    </header>
  );
}
