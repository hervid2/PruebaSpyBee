'use client';
/**
 * Drag-and-drop attachment picker for the create form. Splits uploads into
 * media vs. document tabs (each with its own accepted MIME types), previews
 * images as thumbnails, and lifts the chosen `File[]` to the parent form.
 */
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, X, FileText, Video } from 'lucide-react';
import styles from './FileUploader.module.scss';

type FileTab = 'media' | 'documents';

const MEDIA_ACCEPT = {
  'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
  'video/*': ['.mp4', '.mov', '.avi', '.webm'],
};

const DOCUMENT_ACCEPT = {
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
};

/** True for images/videos; documents fall into the other tab. */
const isMediaFile = (f: File) => f.type.startsWith('image/') || f.type.startsWith('video/');

interface Props {
  value: File[];
  onChange: (files: File[]) => void;
}

export default function FileUploader({ value, onChange }: Props) {
  const [activeTab, setActiveTab] = useState<FileTab>('media');

  const displayedFiles =
    activeTab === 'media' ? value.filter(isMediaFile) : value.filter((f) => !isMediaFile(f));

  const onDrop = useCallback(
    (accepted: File[]) => {
      onChange([...value, ...accepted]);
    },
    [value, onChange],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: activeTab === 'media' ? MEDIA_ACCEPT : DOCUMENT_ACCEPT,
    multiple: true,
  });

  const removeFile = (target: File) => {
    onChange(value.filter((f) => f !== target));
  };

  return (
    <div className={styles.uploader}>
      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div className={styles.uploader__tabs} role="tablist" aria-label="Tipo de archivos adjuntos">
        {(['media', 'documents'] as FileTab[]).map((tab) => (
          <button
            key={tab}
            role="tab"
            type="button"
            aria-selected={activeTab === tab}
            className={`${styles.uploader__tab} ${activeTab === tab ? styles['uploader__tab--active'] : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'media' ? 'Imágenes y Videos' : 'Documentos'}
          </button>
        ))}
      </div>

      {/* ── Dropzone ──────────────────────────────────────────────────────── */}
      <div
        {...getRootProps()}
        className={`${styles.uploader__dropzone} ${isDragActive ? styles['uploader__dropzone--active'] : ''}`}
        aria-label={
          activeTab === 'media' ? 'Zona para subir imágenes y videos' : 'Zona para subir documentos'
        }
      >
        <input {...getInputProps()} />
        <UploadCloud size={24} className={styles.uploader__upload_icon} aria-hidden />
        <p className={styles.uploader__hint}>
          {isDragActive
            ? 'Suelta los archivos aquí…'
            : 'Arrastra archivos o haz clic para seleccionar'}
        </p>
        <p className={styles.uploader__formats}>
          {activeTab === 'media'
            ? 'JPG, PNG, GIF, SVG, MP4, MOV, AVI, WEBM'
            : 'PDF, DOC, DOCX, XLS, XLSX'}
        </p>
      </div>

      {/* ── Preview grid / empty state ────────────────────────────────────── */}
      {displayedFiles.length === 0 ? (
        <p className={styles.uploader__empty} aria-live="polite">
          No hay medios disponibles
        </p>
      ) : (
        <ul
          className={styles.uploader__grid}
          role="list"
          aria-label="Vista previa de archivos adjuntos"
        >
          {displayedFiles.map((file, i) => (
            <li key={`${file.name}-${i}`} className={styles.uploader__item}>
              {file.type.startsWith('image/') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className={styles.uploader__thumbnail}
                />
              ) : (
                <div className={styles.uploader__file_icon} aria-hidden="true">
                  {file.type.startsWith('video/') ? <Video size={20} /> : <FileText size={20} />}
                </div>
              )}
              <p className={styles.uploader__filename} title={file.name}>
                {file.name}
              </p>
              <button
                type="button"
                className={styles.uploader__remove}
                onClick={() => removeFile(file)}
                aria-label={`Eliminar ${file.name}`}
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
