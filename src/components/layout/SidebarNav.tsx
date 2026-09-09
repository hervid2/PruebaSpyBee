'use client';
/**
 * Vertical icon navigation rail. Highlights the active route from the current
 * pathname and shows the signed-in user's avatar at the top. Avatar/initials
 * render only once hydrated to avoid an SSR mismatch (auth is cookie-based).
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  LayoutDashboard,
  Map,
  Info,
  Clock,
  Calendar,
  Image as ImageIcon,
  FolderOpen,
  Settings,
  Share2,
  Trash2,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useIsHydrated } from '@/hooks/useIsHydrated';
import FlyIcon from '@/components/ui/FlyIcon';
import styles from './SidebarNav.module.scss';

interface NavItem {
  href: string;
  icon: React.ReactNode;
  label: string;
}

// Primary destinations; /dashboard, /mapa, /historial, /calendario, /galeria
// and /documentos are implemented — /informacion is still a navigational
// placeholder for a future route.
const mainNavItems: NavItem[] = [
  { href: '/', icon: <Home size={20} />, label: 'Inicio' },
  { href: '/dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
  { href: '/mapa', icon: <Map size={20} />, label: 'Mapa' },
  { href: '/informacion', icon: <Info size={20} />, label: 'Información' },
  { href: '/historial', icon: <Clock size={20} />, label: 'Historial' },
  { href: '/calendario', icon: <Calendar size={20} />, label: 'Calendario' },
  { href: '/galeria', icon: <ImageIcon size={20} />, label: 'Galería' },
  { href: '/documentos', icon: <FolderOpen size={20} />, label: 'Documentos' },
];

const bottomNavItems: NavItem[] = [
  { href: '/papelera', icon: <Trash2 size={20} />, label: 'Papelera' },
  { href: '/ajustes', icon: <Settings size={20} />, label: 'Ajustes' },
  { href: '/compartir', icon: <Share2 size={20} />, label: 'Compartir' },
];

interface SidebarNavProps {
  activeHref?: string;
  projectName?: string;
}

export default function SidebarNav({
  activeHref,
  projectName = 'Proyecto Onboarding',
}: SidebarNavProps) {
  const pathname = usePathname();
  const active = activeHref ?? pathname;
  const user = useAuthStore((s) => s.user);
  const mounted = useIsHydrated();

  const avatarUrl = mounted ? user?.avatarUrl : undefined;
  const initials =
    mounted && user
      ? user.name
          .split(' ')
          .map((w) => w[0])
          .join('')
          .slice(0, 2)
          .toUpperCase()
      : 'S';

  return (
    <nav className={styles.sidebar} aria-label="Navegación principal">
      <div className={styles.sidebar__top}>
        <div
          className={styles['sidebar__project-avatar']}
          aria-label={mounted && user ? user.name : 'Usuario'}
          role="img"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" width={44} height={36} />
          ) : (
            <span style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>{initials}</span>
          )}
        </div>

        {mainNavItems.map((item) => {
          const isActive = active === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles['sidebar__nav-item']}${isActive ? ` ${styles['sidebar__nav-item--active']}` : ''}`}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              title={item.label}
            >
              {item.icon}
            </Link>
          );
        })}
      </div>

      <div className={styles.sidebar__bottom}>
        <div className={styles.sidebar__divider} role="separator" />
        {bottomNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={styles['sidebar__nav-item']}
            aria-label={item.label}
            title={item.label}
          >
            {item.icon}
          </Link>
        ))}
      </div>

      <div className={styles.sidebar__title} aria-hidden="true">
        <span>{projectName}</span>
        <FlyIcon size={16} />
      </div>
    </nav>
  );
}
