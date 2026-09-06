/**
 * Gallery route (server component). Fetches a page of the org's image/video
 * media server-side, same server-paginated pattern as `/historial` and
 * `/papelera`. Unlike those two, `GET /media` isn't role-gated — every
 * authenticated org member can view the gallery, so there's no forbidden state.
 */
import { getGalleryMedia } from '@/services/gallery.service';
import GalleryView from '@/components/gallery/GalleryView';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Galería',
};

interface GaleriaPageProps {
  searchParams: { page?: string };
}

export default async function GaleriaPage({ searchParams }: GaleriaPageProps) {
  const parsedPage = Number(searchParams.page);
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const gallery = await getGalleryMedia(page);
  return (
    <GalleryView
      items={gallery.items}
      total={gallery.total}
      page={gallery.page}
      pageSize={gallery.pageSize}
    />
  );
}
