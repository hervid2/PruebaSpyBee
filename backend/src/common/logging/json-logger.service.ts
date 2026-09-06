import { LoggerService, LogLevel } from '@nestjs/common';

/**
 * One JSON object per line to stdout/stderr — CloudWatch treats each Lambda
 * stdout/stderr line as a separate log event, so this shape is what makes
 * fields (level, context) queryable in CloudWatch Logs Insights instead of
 * free-text grepping. Used in production only (see `bootstrap.ts#createLogger`);
 * local dev/CI keep Nest's readable console logger.
 *
 * An object message is *flattened* into the entry rather than nested under
 * `message`, so the fields `HttpLoggingInterceptor`/`AllExceptionsFilter` emit
 * (`requestId`, `statusCode`, `durationMs`, …) are addressable in Insights as
 * top-level names — `filter statusCode >= 500`, not `filter message.statusCode`.
 */
export class JsonLogger implements LoggerService {
  log(message: unknown, context?: string): void {
    this.write('log', message, context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.write('error', message, context, trace);
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write('verbose', message, context);
  }

  private write(
    level: LogLevel,
    message: unknown,
    context?: string,
    trace?: string,
  ): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      ...toFields(message),
      ...(context ? { context } : {}),
      ...(trace ? { trace } : {}),
    };
    const line = JSON.stringify(entry) + '\n';
    if (level === 'error') {
      process.stderr.write(line);
    } else {
      process.stdout.write(line);
    }
  }
}

/**
 * Plain objects become the entry's own fields; everything else (strings, which
 * is what Nest's own bootstrap logging passes, arrays, Errors) stays nested
 * under `message`.
 */
function toFields(message: unknown): Record<string, unknown> {
  if (!isPlainObject(message)) return { message };
  const fields = { ...message };
  // `write` spreads this *after* `timestamp`/`level`, so a caller field by
  // either name would silently replace the entry's own — every line keeps the
  // same two anchor fields instead.
  delete fields.timestamp;
  delete fields.level;
  return fields;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
