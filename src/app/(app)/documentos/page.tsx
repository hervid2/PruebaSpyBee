/**
 * Documents route (server component). Fetches a page of the org's
 * document-type media server-side, same server-paginated pattern as
 * `/galeria` and `/papelera`. Like `/galeria`, `GET /media` isn't role-gated,
 * so there's no forbidden state.
 */
import { getDocumentsMedia } from '@/services/documents.service';
import DocumentsView from '@/components/documents/DocumentsView';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Documentos',
};

interface DocumentosPageProps {
  searchParams: { page?: string };
}

export default async function DocumentosPage({ searchParams }: DocumentosPageProps) {
  const parsedPage = Number(searchParams.page);
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

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
