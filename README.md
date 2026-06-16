# Spybee — Gestión de Incidencias

Frontend para el módulo de gestión de incidencias de Spybee.

> **Demo en producción →** _enlace de Vercel a añadir tras el primer deploy a `main`_
>
> **Repositorio →** `https://github.com/hervid2/PruebaSpyBee`

---

## Contenido

1. [Funcionalidades](#funcionalidades)
2. [Stack tecnológico](#stack-tecnológico)
3. [Arquitectura](#arquitectura)
4. [Primeros pasos](#primeros-pasos)
5. [Variables de entorno](#variables-de-entorno)
6. [Credenciales de demo](#credenciales-de-demo)
7. [Pruebas](#pruebas)
8. [CI/CD](#cicd)
9. [Decisiones técnicas](#decisiones-técnicas)

---

## Funcionalidades

### Vista de Mapa (`/mapa`)

- **Mapa Mapbox GL** en modo `streets-v12`, con soporte toggle 2D/3D nativo.
- **Marcadores de incidencia** sobre el mapa con popup de resumen al hacer clic.
- **Barra de filtros** (selector de fecha + slider "Últimas N visitas") conectada a `useFiltersStore`.
- **Toolbar flotante**: controles de navegación, capas, timelapse, captura y vista 360°.
- **Botón `+`** que abre el modal de creación de incidencias.

### Modal de Creación (`CreateIssueModal`)

Formulario completo validado con React Hook Form + Zod:

| Campo                | Control                                                  | Requerido |
| -------------------- | -------------------------------------------------------- | --------- |
| Título               | `input[text]`                                            | Sí        |
| Descripción          | `textarea`                                               | Sí        |
| Fecha de vencimiento | `input[date]`                                            | Sí        |
| Categoría            | `select` + `CategoryManagerModal`                        | Sí        |
| Prioridad            | `select` (Alta / Media / Baja)                           | Sí        |
| Etiquetas            | `TagTreeSelect` (árbol con checkboxes + chips)           | No        |
| Asignados            | `UserMultiSelect` (agrupado por compañía)                | No        |
| Observadores         | `UserMultiSelect`                                        | No        |
| Ubicación            | `LocationPicker` (mini-mapa + lat/lng)                   | No        |
| Archivos adjuntos    | `FileUploader` (drag&drop, pestañas imágenes/documentos) | No        |

### Dashboard de Incidencias (`/dashboard`)

- **KeyMetricsRow** — 6 KPIs: Abiertas, Creadas en el período, Cerradas, Tasa de cierre, Tiempo medio de resolución, Vencidas activas.
- **StatusChartsRow** — Donuts de distribución por estado y por prioridad.
- **TrendAreaChart** — Área de tendencia creadas vs. cerradas (toggle Día/Semana/Mes).
- **RiskIndicators** — 4 chips clicables que filtran la tabla: Vencidas hoy, Sin actualizar 7d+, Alta prioridad abiertas, Próximas a vencer 7d.
- **CriticalIssuesList** — Tabla paginada y ordenable por prioridad/vencimiento.
- **HeatmapSection** — Capa heatmap Mapbox GL + CalendarActivity.
- **DistributionCharts** — RadarChart por categoría + Treemap por etiqueta.
- **TeamPerformance** — Barras horizontales: quién resuelve más, quién reporta más, carga de trabajo.
- **DashboardFiltersModal** — Período, estado, prioridad, creado por usuario, responsable.

### Autenticación

- Formulario de login validado con Zod.
- Sesión en cookie (`spybee-session`) gestionada por `useAuthStore` (Zustand + `persist`).
- `middleware.ts` protege todas las rutas bajo `/mapa` y `/dashboard`.

---

## Stack tecnológico

| Capa           | Herramienta              | Versión |
| -------------- | ------------------------ | ------- |
| Framework      | Next.js (App Router)     | 14      |
| Lenguaje       | TypeScript (strict)      | 5       |
| Estado global  | Zustand                  | 5       |
| Mapas          | Mapbox GL JS (nativo)    | 3       |
| Gráficos       | Recharts                 | 3       |
| Formularios    | React Hook Form          | 7       |
| Validación     | Zod                      | 4       |
| Estilos        | SCSS Modules (BEM)       | —       |
| Archivos       | React Dropzone           | 15      |
| Fechas         | date-fns                 | 4       |
| Iconos         | Lucide React             | —       |
| Tests unit/int | Vitest + Testing Library | 4 / 16  |
| Tests E2E      | Playwright               | 1.60    |
| CI/CD          | GitHub Actions → Vercel  | —       |

---

## Arquitectura

```text
spybee-incidencias/
├── .github/workflows/
│   ├── ci.yml               # Lint → type-check → test → build → E2E
│   └── deploy.yml           # Deploy a Vercel en push a main
├── e2e/                     # Specs Playwright
│   ├── helpers/auth.ts
│   ├── auth.spec.ts
│   ├── create-incident.spec.ts
│   └── dashboard-filters.spec.ts
├── public/mocks/
│   └── incidents.mock.json  # Datos de incidencias (fuente de verdad)
├── src/
│   ├── app/                 # App Router (Next.js)
│   │   ├── (auth)/login/    # Pantalla de login
│   │   ├── (app)/
│   │   │   ├── mapa/        # Vista de mapa
│   │   │   └── dashboard/   # Vista de dashboard
│   │   └── middleware.ts    # Guard de autenticación
│   ├── components/
│   │   ├── layout/          # AppLayout, SidebarNav, TopBar
│   │   ├── map/             # MapboxViewer, MapFilterBar, MapToolbar, Markers
│   │   ├── dashboard/       # 11 widgets del dashboard
│   │   └── modals/          # CreateIssueModal y sub-componentes
│   ├── domain/
│   │   ├── models/          # Tipos TypeScript (Incident, Filters, Metrics)
│   │   └── selectors/       # Funciones puras de cálculo (testeables sin React)
│   ├── services/            # Capa de acceso a datos (async, invertible)
│   ├── store/               # Zustand stores por dominio
│   ├── hooks/               # useMapbox, useDashboardMetrics
│   ├── lib/
│   │   ├── constants/       # incident-types, mock-users
│   │   └── validators/      # Esquemas Zod
│   └── styles/
│       ├── abstracts/       # _variables.scss, _mixins.scss
│       └── base/            # _reset.scss, _typography.scss
└── __tests__/               # Vitest — unit + integración
    ├── domain/
    ├── store/
    ├── components/
    ├── validators/
    └── fixtures/
```

### Flujo de datos

```
page.tsx (Server Component)
  └─ await incidentsService.getIncidents()   ← lee incidents.mock.json
       └─ IssuesStoreProvider (context)
            └─ DashboardView / MapaView (Client Components)
                 ├─ useIssuesStore(selector)   ← estado hidratado
                 ├─ useFiltersStore(selector)  ← filtros globales
                 └─ useDashboardMetrics()      ← selector puro memoizado
                      └─ getDashboardMetrics(incidents, filters)
```

---

## Primeros pasos

### Requisitos

- Node.js ≥ 20
- npm ≥ 10
- Token de Mapbox GL (gratis en [account.mapbox.com](https://account.mapbox.com))

### Instalación

```bash
git clone <url-del-repositorio>
cd spybee-incidencias
npm install
cp .env.example .env.local
# Edita .env.local y añade tu NEXT_PUBLIC_MAPBOX_TOKEN
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) y accede con las credenciales de demo.

### Scripts disponibles

```bash
npm run dev           # Servidor de desarrollo (hot reload)
npm run build         # Build de producción
npm run start         # Servidor de producción (requiere build previo)
npm run lint          # ESLint
npm run type-check    # TypeScript sin emitir archivos
npm run test          # Vitest (una ejecución)
npm run test:watch    # Vitest en modo watch
npm run test:coverage # Vitest con informe de cobertura HTML
npm run test:e2e      # Playwright E2E (requiere servidor activo en :3000)
```

---

## Variables de entorno

| Variable                   | Descripción                                                 | Requerida |
| -------------------------- | ----------------------------------------------------------- | --------- |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Token público de Mapbox GL JS                               | Sí        |
| `NEXT_PUBLIC_APP_URL`      | URL base de la app (para redirects absolutos en middleware) | No        |

---

## Credenciales de demo

| Empresa             | Email                            | Contraseña        |
| ------------------- | -------------------------------- | ----------------- |
| Spybee (Superadmin) | `julian.lozano@spybee.io`        | `spybee123`       |
| Constructora        | `mateo.soto@constructora.com`    | `constructora123` |
| Prueba Empresa      | `carlos.lopez@pruebaempresa.com` | `prueba123`       |

> Las credenciales están en `src/services/auth.service.ts`. Sustituir ese archivo por llamadas a un backend real no requiere cambios en componentes ni en el middleware.

---

## Pruebas

### Unitarias e integración (Vitest)

```bash
npm run test             # Ejecuta todos los tests una vez
npm run test:watch       # Modo interactivo
npm run test:coverage    # Genera informe de cobertura en /coverage
```

**Cobertura objetivo: ≥ 70% en `src/domain/` y `src/store/`.**

Suite actual (~100 tests):

| Módulo                        | Tests | Qué verifica                                                      |
| ----------------------------- | ----- | ----------------------------------------------------------------- |
| `domain/selectors`            | 27    | `getDashboardMetrics` — KPIs, riesgo, tendencia, equipo, filtrado |
| `store/useIssuesStore`        | 7     | Factory store, `addIncident`, estado inicial                      |
| `store/useFiltersStore`       | 7     | Filtros de mapa y dashboard, merge parcial                        |
| `store/useModalStore`         | 5     | Apertura/cierre de modales, aislamiento de estado                 |
| `components/CreateIssueModal` | 9     | Render, validación inline, flujo de envío completo                |
| `components/TagTreeSelect`    | 9     | Árbol jerárquico, estado indeterminado, chips removibles          |
| `components/UserMultiSelect`  | 9     | Agrupación por compañía, búsqueda, chips                          |
| `components/FileUploader`     | 13    | Pestañas, dropzone, previsualización, tipos rechazados            |
| `validators/issueFormSchema`  | 18    | Casos válidos e inválidos con Zod (fechas, lat/lng, longitudes)   |

### E2E (Playwright)

```bash
# Con servidor de producción (recomendado para CI):
npm run build
npm run start &
npm run test:e2e

# Con servidor de desarrollo:
PLAYWRIGHT_DEV=1 npm run test:e2e

# Ver informe HTML tras la ejecución:
npx playwright show-report
```

**Proyectos configurados:** Desktop Chrome (1280×800) + Mobile Chrome (Pixel 5, 393×851).

| Spec                        | Escenarios principales                                                                               |
| --------------------------- | ---------------------------------------------------------------------------------------------------- |
| `auth.spec.ts`              | Login válido/inválido, validación email, rutas protegidas, smoke móvil                               |
| `create-incident.spec.ts`   | Apertura modal, Escape/Cancelar, validación vacío, flujo completo, sub-modal categorías, smoke móvil |
| `dashboard-filters.spec.ts` | Período (7d/30d/90d), modal de filtros, limpiar, chips de riesgo, paginación, smoke móvil            |

---

## CI/CD

### `.github/workflows/ci.yml` — calidad (en cada PR/push a `main` / `develop`)

```
quality job:
  npm ci → lint → type-check → test --coverage → build

e2e job (necesita quality):
  npm ci → playwright install → build → test:e2e → sube playwright-report/
```

### `.github/workflows/deploy.yml` — despliegue (push a `main`)

```
deploy job:
  vercel pull → vercel build --prod → vercel deploy --prebuilt --prod
```

**Secrets de GitHub requeridos:** `VERCEL_TOKEN`, `NEXT_PUBLIC_MAPBOX_TOKEN`.

**Branch protection en `main`:** requiere que `quality` y `e2e` estén en verde antes de permitir el merge.

---

## Decisiones técnicas

### 1. Zustand factory/context pattern

**Problema:** Un store Zustand singleton en Next.js App Router leakea estado entre peticiones de distintos usuarios en producción ([documentado en Zustand SSR guide](https://zustand.docs.pmnd.rs/guides/nextjs)).

**Decisión:** Cada store se crea con `createStore` (API vanilla) y se expone vía React Context. Los `page.tsx` crean una instancia nueva por request, hidratada con datos del servidor.

**Consecuencia asumida:** El estado de incidencias creadas localmente no persiste entre navegaciones — limitación correcta en un sistema sin backend real.

---

### 2. Mapbox GL JS nativo (sin `react-map-gl`)

**Motivación:** Inicializar `mapboxgl.Map` directamente en `useEffect` con `useRef` y cleanup manual sigue el patrón recomendado por Mapbox para frameworks SSR y evita la complejidad adicional de un wrapper de React.

---

### 3. Recharts para todos los gráficos del dashboard

**Motivación:** Cubre Donut (Pie con `innerRadius`), Área, Radar y Treemap desde una sola librería composable en React. Evita instalar Chart.js (requiere plugin extra para Treemap) o D3 (curva de aprendizaje mucho más alta).

---

### 4. Vitest en lugar de Jest

**Motivación:** Vitest usa Vite internamente, arranca ~10× más rápido en modo watch, y su API es idéntica a la de Jest. No requiere transformaciones especiales para ESM ni TypeScript en Next.js moderno.

---

### 5. Autenticación simulada sin next-auth

**Motivación:** `next-auth` requiere un adaptador de base de datos o un proveedor OAuth. Para una demo sin backend, la solución de `useAuthStore` + `auth.service.ts` + `middleware.ts` es arquitectónicamente equivalente (la misma cookie controla el acceso) y trivialmente sustituible por una implementación real.

---

### 6. Selectores de dominio como funciones puras

**Motivación:** `getDashboardMetrics(incidents, filters)` en `domain/selectors/` recibe arrays planos y devuelve métricas calculadas sin ninguna dependencia de React. Esto permite 27 tests unitarios que corren en milisegundos, y garantiza que reemplazar la fuente de datos no rompe los cálculos.

---

## Licencia

MIT
