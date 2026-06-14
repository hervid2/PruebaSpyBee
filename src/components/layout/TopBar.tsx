import Link from 'next/link';
import { ChevronDown, Globe } from 'lucide-react';
import styles from './TopBar.module.scss';

interface TopBarProps {
  projectName?: string;
  userName?: string;
  userRole?: string;
  userInitials?: string;
}

export default function TopBar({
  projectName = 'Proyecto Onboarding',
  userName = 'Usuario',
  userRole = 'Superadmin',
  userInitials = 'U',
}: TopBarProps) {
  return (
    <header className={styles.topbar}>
      <Link href="/" className={styles.topbar__logo} aria-label="Spybee - Inicio">
        <span className={styles.topbar__logo_text}>Spybee</span>
      </Link>

      <span className={styles.topbar__title} aria-live="polite">
        {projectName}
      </span>

      <div className={styles.topbar__actions}>
        <button
          className={styles.topbar__lang_selector}
          aria-label="Seleccionar idioma"
          type="button"
        >
          <Globe size={14} aria-hidden="true" />
          <span>ES</span>
          <ChevronDown size={12} aria-hidden="true" />
        </button>

        <button
          className={styles.topbar__user}
          aria-label={`Usuario: ${userName} — ${userRole}`}
          type="button"
        >
          <div className={styles.topbar__user_avatar} aria-hidden="true">
            {userInitials}
          </div>
          <div className={styles.topbar__user_info}>
            <span className={styles.topbar__user_name}>{userName}</span>
            <span className={styles.topbar__user_role}>{userRole}</span>
          </div>
          <ChevronDown size={14} aria-hidden="true" style={{ color: 'rgba(255,255,255,0.5)' }} />
        </button>

        <button className={styles.topbar__help} aria-label="Ayuda" type="button">
          ?
        </button>
      </div>
    </header>
  );
}
