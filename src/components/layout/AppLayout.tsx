/**
 * Shared chrome for authenticated pages: fixed top bar, sidebar nav and the
 * main content slot. Includes a skip link as the first focusable element for
 * keyboard/screen-reader accessibility, and the one dialog the chrome itself
 * can open.
 */
import TopBar from './TopBar';
import SidebarNav from './SidebarNav';
import InviteCollaboratorsModal from '@/components/modals/invite/InviteCollaboratorsModal';
import styles from './AppLayout.module.scss';

interface AppLayoutProps {
  children: React.ReactNode;
  activeHref?: string;
  projectName?: string;
}

export default function AppLayout({ children, activeHref, projectName }: AppLayoutProps) {
  return (
    <div className={styles['app-layout']}>
      <a href="#main-content" className={styles['skip-link']}>
        Saltar al contenido principal
      </a>
      <TopBar projectName={projectName} />
      <SidebarNav activeHref={activeHref} projectName={projectName} />
      <main className={styles['app-layout__content']} id="main-content" tabIndex={-1}>
        {children}
      </main>
      {/* Here rather than in a page: both the sidebar's "Compartir" and the
          map toolbar's Share button open it, and the sidebar is everywhere. */}
      <InviteCollaboratorsModal />
    </div>
  );
}
