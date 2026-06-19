/**
 * Static catalog of incident categories (ids mirror the real API). Feeds the
 * category selector in the create form and labels charts in the dashboard;
 * centralizing it keeps type ids/names consistent across the app.
 */
import type { IncidentType } from '@/domain/models';

export const INCIDENT_TYPES: IncidentType[] = [
  { id: 'e05995817a9a9bf5c0298f7d', key: 'plumbing', name: 'Hidrosanitario', name_en: 'Plumbing' },
  {
    id: '9a92d827f32fdf3729e233e7',
    key: 'coordination',
    name: 'Coordinación de Diseños',
    name_en: 'Coordination',
  },
  { id: '074cf498175293d292634177', key: 'electrical', name: 'Electrico', name_en: 'Electrical' },
  {
    id: '17e0a4611debf0541f304dc1',
    key: 'infrastructure',
    name: 'Infraestructura',
    name_en: 'Infrastructure',
  },
  {
    id: 'd123615675901ace745a9ebc',
    key: 'safety_hazard',
    name: 'Prevención de riesgos',
    name_en: 'Safety hazard',
  },
  { id: '6b2e93038669ec55c98bdd30', key: 'structural', name: 'Estructural', name_en: 'Structural' },
  { id: 'd9da51900eb9cd4d3e425a32', key: 'materials', name: 'Materiales', name_en: 'Materials' },
  { id: 'c13c63a4217f35835ef33cc2', key: 'masonry', name: 'Mamposteria', name_en: 'Masonry' },
  { id: 'arch_001', key: 'architectural', name: 'Arquitectónico', name_en: 'Architectural' },
  { id: 'stab_001', key: 'stability', name: 'Estabilidad', name_en: 'Stability' },
  {
    id: 'obs_001',
    key: 'observation',
    name: 'Observación General',
    name_en: 'General Observation',
  },
];
