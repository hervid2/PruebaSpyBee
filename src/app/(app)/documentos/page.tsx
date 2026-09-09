/**
 * Documents route (server component). Fetches a page of the org's
 * document-type media server-side, same server-paginated pattern as
 * `/galeria` and `/papelera`. Like `/galeria`, `GET /media` isn't role-gated,
 * so there's no forbidden state.
 */
import { getDocumentsMedia } from '@/services/documents.service';
import { parsePageParam } from '@/lib/search-params';
import DocumentsView from '@/components/documents/DocumentsView';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Documentos',
};

export default async function DocumentosPage({ searchParams }: PageProps<'/documentos'>) {
  const page = parsePageParam((await searchParams).page);

  const documents = await getDocumentsMedia(page);
  return (
    <DocumentsView
      items={documents.items}
      total={documents.total}
      page={documents.page}
      pageSize={documents.pageSize}
    />
  );
}
