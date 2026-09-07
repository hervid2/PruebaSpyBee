import {
  ConsoleLogger,
  INestApplication,
  LoggerService,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { HttpLoggingInterceptor } from './common/logging/http-logging.interceptor';
import { JsonLogger } from './common/logging/json-logger.service';
import {
  REQUEST_ID_HEADER,
  requestContextMiddleware,
} from './common/logging/request-context';

/** Passed to `NestFactory.create` — must be picked before the app instance exists. */
export function createLogger(): LoggerService {
  return process.env.NODE_ENV === 'production'
    ? new JsonLogger()
    : new ConsoleLogger();
}

/** Applies the app-wide setup shared by the local dev server (main.ts) and the Lambda handler (lambda.ts). */
export function configureApp(app: INestApplication): void {
  const configService = app.get(ConfigService);

  // First in the chain: everything downstream (including the filter that
  // answers a request no route ever matched) reads the id and start time it
  // attaches (F9.3).
  app.use(requestContextMiddleware);
  const apiDocsEnabled = isApiDocsEnabled(configService);
  app.use(
    helmet({
      // Swagger UI's inline bootstrap script fails a strict default CSP, so
      // CSP used to be off for the whole API just to keep the docs page
      // working (F6.3). With the docs now opt-in (below), the default policy
      // is back on wherever they are off — which in production is the norm.
      //
      // A CSP on a JSON API is not the main event, but it is the header that
      // decides what a browser will do with a response it was tricked into
      // rendering as a document, and `default-src 'none'` makes that nothing
      // at all (F9.4).
      contentSecurityPolicy: apiDocsEnabled ? false : undefined,
    }),
  );
  app.enableCors({
    // The deployed Vercel origin in production (SAM `FrontendOrigin`
    // parameter, F6.3); never `*` — the refresh-token cookie relies on
    // `credentials: true`, which the CORS spec forbids combining with a
    // wildcard origin anyway.
    origin: configService.get<string>(
      'FRONTEND_ORIGIN',
      'http://localhost:3000',
    ),
    credentials: true,
    // Without this the browser hides `x-request-id` from the page's own JS —
    // the correlation id would exist on every response and be readable by
    // nobody but curl (F9.3).
    exposedHeaders: [REQUEST_ID_HEADER],
  });
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalInterceptors(new HttpLoggingInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  if (apiDocsEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('FlyWorkFlow API')
      .setDescription(
        'Incident management API for construction/maintenance projects',
      )
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }
}

/**
 * `/api/docs` publishes the complete route inventory — every path, parameter
 * and DTO shape — to anyone who asks, unauthenticated. That is exactly what
 * it is for in development and exactly what reconnaissance wants in
 * production, so the default flips with the environment: on everywhere
 * except production, opt-in there via `ENABLE_API_DOCS=true` (F9.4).
 *
 * It stays deliberately possible to turn on: this is a portfolio API whose
 * docs page is worth showing. Making it a decision someone has to take, and
 * one whose cost (see the CSP above) is written down, is the point — not
 * making it impossible.
 */
function isApiDocsEnabled(configService: ConfigService): boolean {
  const explicit = configService.get<string>('ENABLE_API_DOCS');
  if (explicit !== undefined) return explicit === 'true';
  return configService.get<string>('NODE_ENV') !== 'production';
}
