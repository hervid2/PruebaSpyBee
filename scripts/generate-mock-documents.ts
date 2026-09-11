/**
 * Writes the demo PDFs that seeded `document` attachments link to, under
 * `public/mocks/documentos/`, plus `public/mocks/documents.mock.json`, the
 * manifest `backend/prisma/seed.ts` reads to attach them.
 *
 * The mock dataset has never contained a document — 251 images and 68 videos,
 * nothing else — so `/documentos` had no row to render in any environment and
 * its table had never been audited (roadmap F9.7). These are served by the
 * frontend itself rather than the media bucket: there is no bucket in local
 * dev or CI, and a seed that needs AWS credentials is a seed nobody runs.
 *
 * Hand-rolled rather than a PDF library: each file is one page of plain text,
 * which is a few dozen lines of the format, and a dependency for that would
 * outlive the one script that needs it. Output is byte-for-byte deterministic
 * (no creation date, no random ids), so regenerating without changing this
 * file produces no diff. Run with `npm run generate-mock-documents`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MOCKS_DIR = resolve(__dirname, '../public/mocks');
const OUTPUT_DIR = resolve(MOCKS_DIR, 'documentos');
const MANIFEST_PATH = resolve(MOCKS_DIR, 'documents.mock.json');

interface DemoDocument {
  slug: string;
  title: string;
  /** Keys from the shared 15-type catalog; every key must appear exactly once across the list. */
  incidentTypes: string[];
  body: string[];
}

const DISCLAIMER = 'Documento de demostración con datos ficticios — generado para FlyWorkFlow.';

const DOCUMENTS: DemoDocument[] = [
  {
    slug: 'acta-de-visita',
    title: 'Acta de visita de obra',
    incidentTypes: ['observation', 'coordination', 'architectural', 'urban_planning'],
    body: [
      '1. Objeto',
      'Registro de la visita técnica al frente de obra y verificación del',
      'estado reportado en la incidencia vinculada.',
      '',
      '2. Asistentes',
      'Residente de obra, supervisor técnico y representante de interventoría.',
      '',
      '3. Observaciones',
      '- Se verifica en sitio la condición descrita y se toma registro fotográfico.',
      '- Se acuerdan las acciones correctivas y sus responsables.',
      '- Se programa una visita de seguimiento en un plazo de siete días.',
      '',
      '4. Compromisos',
      'El contratista entrega plan de acción antes del próximo comité de obra.',
      '',
      'Firmas: residente de obra / supervisor técnico',
    ],
  },
  {
    slug: 'informe-estructural',
    title: 'Informe técnico estructural',
    incidentTypes: ['structural', 'stability', 'foundation', 'masonry'],
    body: [
      '1. Alcance',
      'Evaluación del elemento señalado en la incidencia vinculada: inspección',
      'visual, medición de fisuras y revisión contra planos estructurales.',
      '',
      '2. Hallazgos',
      '- Fisuras con abertura inferior a 0,3 mm, sin desplazamiento relativo.',
      '- No se evidencia corrosión en el refuerzo expuesto.',
      '- Deflexiones dentro de la tolerancia de diseño (L/360).',
      '',
      '3. Recomendaciones',
      '- Sellado de fisuras con mortero epóxico y monitoreo durante 30 días.',
      '- Instalación de testigos de yeso en los puntos marcados.',
      '',
      '4. Conclusión',
      'El elemento conserva su capacidad portante. No requiere apuntalamiento.',
      '',
      'Ingeniero estructural responsable — matrícula profesional ficticia',
    ],
  },
  {
    slug: 'estudio-de-suelos',
    title: 'Estudio de suelos (extracto)',
    incidentTypes: ['soil-study', 'excavation'],
    body: [
      '1. Exploración',
      'Tres sondeos a percusión hasta 12 m de profundidad, con recuperación de',
      'muestras alteradas cada 1,5 m y ensayo de penetración estándar.',
      '',
      '2. Perfil estratigráfico',
      '- 0,0 a 1,2 m: relleno heterogéneo con escombro.',
      '- 1,2 a 6,5 m: arcilla limosa de consistencia media, humedad alta.',
      '- 6,5 a 12,0 m: arena limosa densa.',
      '',
      '3. Nivel freático',
      'Detectado a 3,8 m en el sondeo 2. Considerar abatimiento en excavaciones.',
      '',
      '4. Recomendación de cimentación',
      'Pilotes preexcavados apoyados en el estrato de arena densa.',
      '',
      'Laboratorio de geotecnia — informe de demostración',
    ],
  },
  {
    slug: 'certificado-materiales',
    title: 'Certificado de conformidad de materiales',
    incidentTypes: ['materials'],
    body: [
      '1. Material',
      'Lote entregado en obra según remisión asociada a la incidencia vinculada.',
      '',
      '2. Ensayos realizados',
      '- Resistencia a la compresión a 7 y 28 días.',
      '- Verificación dimensional y de diámetro nominal.',
      '- Revisión de fichas técnicas y trazabilidad del proveedor.',
      '',
      '3. Resultado',
      'Conforme con la especificación técnica del proyecto, salvo lo anotado',
      'en la incidencia, que se trata como no conformidad parcial.',
      '',
      '4. Disposición',
      'Lote liberado para uso. Muestras testigo custodiadas por 90 días.',
      '',
      'Control de calidad — certificado de demostración',
    ],
  },
  {
    slug: 'inspeccion-seguridad',
    title: 'Acta de inspección de seguridad',
    incidentTypes: ['safety_hazard'],
    body: [
      '1. Zona inspeccionada',
      'Frente de trabajo y accesos indicados en la incidencia vinculada.',
      '',
      '2. Condiciones encontradas',
      '- Protección perimetral incompleta en borde de placa.',
      '- Señalización de riesgo ausente en el acceso principal.',
      '- Personal con elementos de protección personal completos.',
      '',
      '3. Medidas inmediatas',
      '- Suspensión de actividades en altura hasta instalar baranda.',
      '- Instalación de señalización y cinta de demarcación.',
      '',
      '4. Verificación',
      'Se programa reinspección antes de reanudar actividades en la zona.',
      '',
      'Coordinador de seguridad y salud en el trabajo',
    ],
  },
  {
    slug: 'informe-redes',
    title: 'Informe de redes técnicas',
    incidentTypes: ['plumbing', 'electrical', 'infrastructure'],
    body: [
      '1. Sistema revisado',
      'Red señalada en la incidencia vinculada: suministro, desagüe o eléctrica.',
      '',
      '2. Pruebas',
      '- Prueba de presión hidrostática durante 2 horas.',
      '- Medición de aislamiento y continuidad en circuitos.',
      '- Inspección con cámara en tramos no visibles.',
      '',
      '3. Resultado',
      'Se localiza el tramo afectado y se documenta en el plano de redes.',
      '',
      '4. Acción correctiva',
      'Reemplazo del tramo, nueva prueba y registro antes del cierre de muros.',
      '',
      'Ingeniero de redes — informe de demostración',
    ],
  },
];

/**
 * The fonts below declare WinAnsiEncoding, which matches Latin-1 for accented
 * letters but puts typographic punctuation at different bytes. Anything else
 * fails here rather than landing in the file as a wrong glyph.
 */
const WIN_ANSI_EXTRAS: Record<string, number> = { '—': 0x97, '–': 0x96, '“': 0x93, '”': 0x94 };

function toWinAnsi(text: string): string {
  return Array.from(text, (char) => {
    const extra = WIN_ANSI_EXTRAS[char];
    if (extra !== undefined) return String.fromCharCode(extra);
    const code = char.charCodeAt(0);
    if (code > 0xff) throw new Error(`No WinAnsi byte for ${JSON.stringify(char)} in: ${text}`);
    return char;
  }).join('');
}

function pdfString(text: string): string {
  return `(${toWinAnsi(text).replace(/[\\()]/g, (c) => `\\${c}`)})`;
}

function buildPdf(doc: DemoDocument): Buffer {
  const content = [
    'BT',
    '/F2 16 Tf',
    '56 770 Td',
    `${pdfString(doc.title)} Tj`,
    '/F1 9 Tf',
    '0 -20 Td',
    `${pdfString(DISCLAIMER)} Tj`,
    '/F1 11 Tf',
    '16 TL',
    '0 -12 Td',
    ...doc.body.flatMap((line) => ['T*', `${pdfString(line)} Tj`]),
    'ET',
  ].join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ' +
      '/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
    // The Info dictionary is PDFDocEncoding, not WinAnsi; the two agree on
    // every byte a title here uses, since none contains typographic punctuation.
    `<< /Title ${pdfString(doc.title)} /Producer (FlyWorkFlow demo data) >>`,
  ];

  let pdf = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets = objects.map((body, index) => {
    const offset = Buffer.byteLength(pdf, 'latin1');
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
    return offset;
  });

  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  // Each cross-reference entry is exactly 20 bytes, trailing space included.
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${objects.length} 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'latin1');
}

mkdirSync(OUTPUT_DIR, { recursive: true });

const manifest = DOCUMENTS.map((doc) => {
  const bytes = buildPdf(doc);
  writeFileSync(resolve(OUTPUT_DIR, `${doc.slug}.pdf`), bytes);
  return {
    slug: doc.slug,
    title: doc.title,
    url: `/mocks/documentos/${doc.slug}.pdf`,
    size: bytes.length,
    incidentTypes: doc.incidentTypes,
  };
});

writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
console.log(`Generated ${manifest.length} documents -> ${OUTPUT_DIR}`);
