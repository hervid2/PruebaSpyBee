/**
 * Component tests for FileUploader: tab switching (media/documents), empty
 * states, image-vs-icon previews, multi-file rendering and removal. Stubs
 * URL.createObjectURL since jsdom doesn't implement it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FileUploader from '@/components/modals/create-issue/FileUploader';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeFile(name: string, type: string): File {
  return new File(['content'], name, { type });
}

function renderUploader(value: File[] = [], onChange = vi.fn()) {
  return render(<FileUploader value={value} onChange={onChange} />);
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('FileUploader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom does not implement URL.createObjectURL
    Object.defineProperty(window.URL, 'createObjectURL', {
      writable: true,
      value: vi.fn(() => 'blob:mock'),
    });
  });

  // ── Tabs ───────────────────────────────────────────────────────────────────

  it('renderiza ambas pestañas', () => {
    renderUploader();
    expect(screen.getByText('Imágenes y Videos')).toBeInTheDocument();
    expect(screen.getByText('Documentos')).toBeInTheDocument();
  });

  it('la pestaña "Imágenes y Videos" está activa por defecto', () => {
    renderUploader();
    const mediaTab = screen.getByRole('tab', { name: 'Imágenes y Videos' });
    expect(mediaTab).toHaveAttribute('aria-selected', 'true');
  });

  it('cambia a la pestaña "Documentos" al hacer clic', () => {
    renderUploader();
    fireEvent.click(screen.getByRole('tab', { name: 'Documentos' }));
    expect(screen.getByRole('tab', { name: 'Documentos' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Imágenes y Videos' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  // ── Empty state ────────────────────────────────────────────────────────────

  it('muestra "No hay medios disponibles" cuando no hay archivos (pestaña media)', () => {
    renderUploader([]);
    expect(screen.getByText('No hay medios disponibles')).toBeInTheDocument();
  });

  it('muestra "No hay medios disponibles" en pestaña "Documentos" sin archivos de ese tipo', () => {
    // Only an image file — Documentos tab should show empty
    const files = [makeFile('foto.jpg', 'image/jpeg')];
    renderUploader(files);
    fireEvent.click(screen.getByRole('tab', { name: 'Documentos' }));
    expect(screen.getByText('No hay medios disponibles')).toBeInTheDocument();
  });

  // ── File preview ───────────────────────────────────────────────────────────

  it('muestra una imagen como <img> con src de object URL', () => {
    const files = [makeFile('foto.png', 'image/png')];
    renderUploader(files);
    const img = screen.getByRole('img', { name: 'foto.png' });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'blob:mock');
  });

  it('muestra un archivo de video con icono (no <img>)', () => {
    const files = [makeFile('clip.mp4', 'video/mp4')];
    renderUploader(files);
    // No img tag should appear for a video
    expect(screen.queryByRole('img', { name: 'clip.mp4' })).not.toBeInTheDocument();
    // filename should be visible
    expect(screen.getByTitle('clip.mp4')).toBeInTheDocument();
  });

  it('muestra documentos PDF en pestaña "Documentos"', () => {
    const files = [makeFile('reporte.pdf', 'application/pdf')];
    renderUploader(files);
    // Switch to documents tab
    fireEvent.click(screen.getByRole('tab', { name: 'Documentos' }));
    expect(screen.getByTitle('reporte.pdf')).toBeInTheDocument();
  });

  it('muestra correctamente varios archivos en la grilla', () => {
    const files = [makeFile('a.jpg', 'image/jpeg'), makeFile('b.png', 'image/png')];
    renderUploader(files);
    expect(screen.getByTitle('a.jpg')).toBeInTheDocument();
    expect(screen.getByTitle('b.png')).toBeInTheDocument();
  });

  // ── Remove file ────────────────────────────────────────────────────────────

  it('llama a onChange sin el archivo eliminado al presionar el botón de eliminar', () => {
    const onChange = vi.fn();
    const fileA = makeFile('a.png', 'image/png');
    const fileB = makeFile('b.png', 'image/png');
    renderUploader([fileA, fileB], onChange);

    fireEvent.click(screen.getByLabelText('Eliminar a.png'));
    expect(onChange).toHaveBeenCalledOnce();
    const updatedFiles: File[] = onChange.mock.calls[0][0];
    expect(updatedFiles).toHaveLength(1);
    expect(updatedFiles[0].name).toBe('b.png');
  });

  it('llama a onChange con array vacío al eliminar el único archivo', () => {
    const onChange = vi.fn();
    const file = makeFile('solo.jpg', 'image/jpeg');
    renderUploader([file], onChange);

    fireEvent.click(screen.getByLabelText('Eliminar solo.jpg'));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  // ── Dropzone hint ──────────────────────────────────────────────────────────

  it('muestra el hint de arrastrar archivos', () => {
    renderUploader();
    expect(screen.getByText('Arrastra archivos o haz clic para seleccionar')).toBeInTheDocument();
  });

  it('muestra formatos aceptados para pestaña "Imágenes y Videos"', () => {
    renderUploader();
    expect(screen.getByText(/JPG.*PNG.*MP4/i)).toBeInTheDocument();
  });

  it('muestra formatos aceptados para pestaña "Documentos"', () => {
    renderUploader();
    fireEvent.click(screen.getByRole('tab', { name: 'Documentos' }));
    expect(screen.getByText(/PDF.*DOC/i)).toBeInTheDocument();
  });
});
