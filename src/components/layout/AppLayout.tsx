import TopBar from './TopBar';
import SidebarNav from './SidebarNav';
import styles from './AppLayout.module.scss';

interface AppLayoutProps {
  children: React.ReactNode;
  activeHref?: string;
}

export default function AppLayout({ children, activeHref }: AppLayoutProps) {
  return (
    <div className={styles['app-layout']}>
      <a href="#main-content" className={styles['skip-link']}>
        Saltar al contenido principal
      </a>
      <TopBar />
      <SidebarNav activeHref={activeHref} />
      <main className={styles['app-layout__content']} id="main-content" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
