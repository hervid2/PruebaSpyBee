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
      <TopBar />
      <SidebarNav activeHref={activeHref} />
      <main className={styles['app-layout__content']} id="main-content">
        {children}
      </main>
    </div>
  );
}
