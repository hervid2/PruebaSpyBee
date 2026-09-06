import { JsonLogger } from './json-logger.service';

interface LoggedEntry {
  timestamp: string;
  level: string;
  message?: unknown;
  context?: string;
  trace?: string;
  [field: string]: unknown;
}

function parseWrittenLine(mock: jest.Mock<boolean, [string]>): LoggedEntry {
  const [line] = mock.mock.calls[0];
  return JSON.parse(line.trim()) as LoggedEntry;
}

describe('JsonLogger', () => {
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  let stdout: jest.Mock<boolean, [string]>;
  let stderr: jest.Mock<boolean, [string]>;

  beforeEach(() => {
    stdout = jest.fn<boolean, [string]>(() => true);
    stderr = jest.fn<boolean, [string]>(() => true);
    process.stdout.write = stdout;
    process.stderr.write = stderr;
  });

  afterEach(() => {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  });

  it('writes log/warn/debug/verbose as a single JSON line to stdout', () => {
    const logger = new JsonLogger();
    logger.log('booted', 'Bootstrap');

    expect(stdout).toHaveBeenCalledTimes(1);
    const parsed = parseWrittenLine(stdout);
    expect(parsed).toMatchObject({
      level: 'log',
      message: 'booted',
      context: 'Bootstrap',
    });
    expect(typeof parsed.timestamp).toBe('string');
  });

  it('writes error entries to stderr with the trace field, not stdout', () => {
    const logger = new JsonLogger();
    logger.error('boom', 'stack trace here', 'AppService');

    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledTimes(1);
    const parsed = parseWrittenLine(stderr);
    expect(parsed).toMatchObject({
      level: 'error',
      message: 'boom',
      trace: 'stack trace here',
      context: 'AppService',
    });
  });

  it('omits context/trace fields entirely when not provided', () => {
    const logger = new JsonLogger();
    logger.warn('careful');

    const parsed = parseWrittenLine(stdout);
    expect(parsed).not.toHaveProperty('context');
    expect(parsed).not.toHaveProperty('trace');
  });

  it('flattens an object message so Insights can query the fields by name', () => {
    const logger = new JsonLogger();
    logger.log(
      { event: 'http_request', statusCode: 200, durationMs: 12.5 },
      'HttpRequest',
    );

    const parsed = parseWrittenLine(stdout);
    expect(parsed).toMatchObject({
      level: 'log',
      event: 'http_request',
      statusCode: 200,
      durationMs: 12.5,
      context: 'HttpRequest',
    });
    expect(parsed).not.toHaveProperty('message');
  });

  it('never lets a caller field shadow the entry’s own timestamp/level', () => {
    const logger = new JsonLogger();
    logger.warn({ level: 'debug', timestamp: 'nope', statusCode: 404 });

    const parsed = parseWrittenLine(stdout);
    expect(parsed.level).toBe('warn');
    expect(parsed.timestamp).not.toBe('nope');
    expect(parsed.statusCode).toBe(404);
  });

  it('keeps a non-plain object (an Error) nested under message', () => {
    const logger = new JsonLogger();
    logger.error(new Error('boom'));

    const parsed = parseWrittenLine(stderr);
    expect(parsed).toHaveProperty('message');
  });
});
