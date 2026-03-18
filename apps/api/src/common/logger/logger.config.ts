import { Params } from 'nestjs-pino';
import { v4 as uuidv4 } from 'uuid';
import { IncomingMessage } from 'http';

export function getLoggerConfig(): Params {
  const isProduction = process.env['NODE_ENV'] === 'production';

  return {
    pinoHttp: {
      genReqId: (req: IncomingMessage) => {
        return (req.headers['x-request-id'] as string) || uuidv4();
      },
      level: isProduction ? 'info' : 'debug',
      transport: isProduction ? undefined : { target: 'pino-pretty' },
      serializers: {
        req(req) {
          return {
            method: req.method,
            url: req.url,
          };
        },
        res(res) {
          return {
            statusCode: res.statusCode,
          };
        },
      },
      customProps: () => ({
        context: 'HTTP',
      }),
      customLogLevel: (_req, res) => {
        if (res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      customSuccessMessage: (req, res) => {
        return `${req.method} ${req.url} ${res.statusCode}`;
      },
      customErrorMessage: (req, res) => {
        return `${req.method} ${req.url} ${res.statusCode}`;
      },
    },
  };
}
