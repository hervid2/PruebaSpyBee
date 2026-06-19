/**
 * Shared chrome for authenticated pages: fixed top bar, sidebar nav and the
 * main content slot. Includes a skip link as the first focusable element for
 * keyboard/screen-reader accessibility.
 */
import TopBar from './TopBar';
import SidebarNav from './SidebarNav';
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
    </div>
  );
}
