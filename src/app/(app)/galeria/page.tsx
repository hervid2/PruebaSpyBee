/**
 * Gallery route (server component). Fetches a page of the org's image/video
 * media server-side, same server-paginated pattern as `/historial` and
 * `/papelera`. Unlike those two, `GET /media` isn't role-gated — every
 * authenticated org member can view the gallery, so there's no forbidden state.
 */
import { getGalleryMedia } from '@/services/gallery.service';
import { parsePageParam } from '@/lib/search-params';
import GalleryView from '@/components/gallery/GalleryView';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Galería',
};

export default async function GaleriaPage({ searchParams }: PageProps<'/galeria'>) {
  const page = parsePageParam((await searchParams).page);

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
