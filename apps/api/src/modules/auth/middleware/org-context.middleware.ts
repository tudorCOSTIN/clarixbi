import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class OrgContextMiddleware implements NestMiddleware {
  use(req: Request & { orgId?: string }, _res: Response, next: NextFunction) {
    const orgId = req.headers['x-org-id'] as string;
    if (orgId && UUID_REGEX.test(orgId)) {
      req.orgId = orgId;
    }
    next();
  }
}
