/**
 * Settings route. Unlike the other Phase 8 pages, there's no server-side
 * data to fetch here: the profile shown/edited is the already-authenticated
 * user, which only exists client-side (the in-memory access token from
 * useAuthStore) — so this is a thin wrapper around a client component.
 */
import SettingsView from '@/components/settings/SettingsView';

export const metadata = {
  title: 'Ajustes',
};

export default function AjustesPage() {
  return <SettingsView />;
}
