import { redirect } from 'next/navigation';

/** Index route: the app has no landing page, so send users to the map view. */
export default function RootPage() {
  redirect('/mapa');
}
