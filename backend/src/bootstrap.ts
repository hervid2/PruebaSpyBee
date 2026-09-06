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
  app.use(
    helmet({
      // Swagger UI's inline bootstrap script fails a strict default CSP;
      // the rest of helmet's headers (HSTS, X-Frame-Options, etc.) still apply.
      contentSecurityPolicy: false,
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
