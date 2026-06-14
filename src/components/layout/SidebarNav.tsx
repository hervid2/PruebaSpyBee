import Link from 'next/link';
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
} from 'lucide-react';
import styles from './SidebarNav.module.scss';

interface NavItem {
  href: string;
  icon: React.ReactNode;
  label: string;
}

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
  { href: '/ajustes', icon: <Settings size={20} />, label: 'Ajustes' },
  { href: '/compartir', icon: <Share2 size={20} />, label: 'Compartir' },
];

interface SidebarNavProps {
  activeHref?: string;
}

export default function SidebarNav({ activeHref }: SidebarNavProps) {
  return (
    <nav className={styles.sidebar} aria-label="Navegación principal">
      <div className={styles.sidebar__top}>
        <div className={styles.sidebar__project_avatar} aria-hidden="true">
          <span style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>S</span>
        </div>

        {mainNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.sidebar__nav_item}${activeHref === item.href ? ` ${styles['sidebar__nav_item--active']}` : ''}`}
            aria-label={item.label}
            title={item.label}
          >
            {item.icon}
          </Link>
        ))}
      </div>

      <div className={styles.sidebar__bottom}>
        <div className={styles.sidebar__divider} />
        {bottomNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={styles.sidebar__nav_item}
            aria-label={item.label}
            title={item.label}
          >
            {item.icon}
          </Link>
        ))}
      </div>
    </nav>
  );
}
