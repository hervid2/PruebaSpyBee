'use client';
import {
  Navigation,
  Layers,
  Mountain,
  Box,
  Clock,
  Camera,
  Rotate3d,
  Star,
  MapPin,
  Brush,
  Share2,
  Map,
  Plus,
  FileStack,
} from 'lucide-react';
import { useFiltersStore } from '@/store/useFiltersStore';
import { useModalStore } from '@/store/useModalStore';
import styles from './MapToolbar.module.scss';

export default function MapToolbar() {
  const is3D = useFiltersStore((s) => s.is3D);
  const toggle3D = useFiltersStore((s) => s.toggle3D);
  const openModal = useModalStore((s) => s.open);

  return (
    <>
      {/* Grupo inferior izquierdo: controles de navegación */}
      <div
        className={styles['toolbar-left']}
        role="toolbar"
        aria-label="Controles de navegación del mapa"
      >
        <button
          className={styles['toolbar__btn']}
          type="button"
          aria-label="Recentrar mapa"
          title="Recentrar"
        >
          <Navigation size={17} />
        </button>
        <button
          className={styles['toolbar__btn']}
          type="button"
          aria-label="Vista de planta o sección"
          title="Planta / Sección"
        >
          <Box size={17} />
        </button>
        <button
          className={styles['toolbar__btn']}
          type="button"
          aria-label="Capas del mapa"
          title="Capas"
        >
          <Layers size={17} />
        </button>
        <button
          className={styles['toolbar__btn']}
          type="button"
          aria-label="Terreno y elevación"
          title="Terreno / Elevación"
        >
          <Mountain size={17} />
        </button>
      </div>

      {/* Grupo inferior central: modo de visualización */}
      <div className={styles['toolbar-center']} role="toolbar" aria-label="Modo de visualización">
        <div
          className={styles['toolbar__toggle-group']}
          role="group"
          aria-label="Proyección 2D o 3D"
        >
          <button
            className={[styles['toolbar__toggle'], !is3D ? styles['toolbar__toggle--active'] : '']
              .filter(Boolean)
              .join(' ')}
            type="button"
            onClick={() => is3D && toggle3D()}
            aria-pressed={!is3D}
          >
            2D
          </button>
          <button
            className={[styles['toolbar__toggle'], is3D ? styles['toolbar__toggle--active'] : '']
              .filter(Boolean)
              .join(' ')}
            type="button"
            onClick={() => !is3D && toggle3D()}
            aria-pressed={is3D}
          >
            3D
          </button>
        </div>

        <span className={styles['toolbar__center-divider']} aria-hidden="true" />

        <button
          className={styles['toolbar__btn']}
          type="button"
          aria-label="Histórico / Timelapse"
          title="Timelapse"
        >
          <Clock size={17} />
        </button>
        <button
          className={styles['toolbar__btn']}
          type="button"
          aria-label="Captura o recorrido"
          title="Captura"
        >
          <Camera size={17} />
        </button>
        <button
          className={styles['toolbar__btn']}
          type="button"
          aria-label="Vista 360°"
          title="360°"
        >
          <Rotate3d size={17} />
        </button>
      </div>

      {/* Grupo derecho: acción primaria y herramientas */}
      <div className={styles['toolbar-right']} role="toolbar" aria-label="Herramientas y acciones">
        <button
          className={styles['toolbar__primary-btn']}
          type="button"
          onClick={() => openModal('create-issue')}
          aria-label="Crear nueva incidencia"
          title="Crear incidencia"
        >
          <Plus size={22} strokeWidth={2.5} />
        </button>

        <div className={styles['toolbar__secondary-group']}>
          {[
            { icon: FileStack, label: 'Planos BIM' },
            { icon: Star, label: 'Favoritos' },
            { icon: MapPin, label: 'Ubicación' },
            { icon: Layers, label: 'Capas' },
            { icon: Map, label: 'Mapa de calor' },
            { icon: Brush, label: 'Anotaciones' },
            { icon: Share2, label: 'Compartir' },
          ].map(({ icon: Icon, label }) => (
            <button
              key={label}
              className={styles['toolbar__btn']}
              type="button"
              aria-label={label}
              title={label}
            >
              <Icon size={17} />
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
