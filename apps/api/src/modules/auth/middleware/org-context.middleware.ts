import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class OrgContextMiddleware implements NestMiddleware {
  use(req: Request & { orgId?: string }, _res: Response, next: NextFunction) {
    const orgId = req.headers['x-org-id'] as string;
    if (orgId) {
      req.orgId = orgId;
    }
    next();
  }
}
