import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { tenantContext } from './tenant.context';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction) {
        const workspaceId = (req.headers['x-workspace-id'] || req.query.workspaceId) as string;

        if (workspaceId) {
            tenantContext.run({ workspaceId }, () => {
                next();
            });
        } else {
            // If no workspaceId, proceed without it (or throw error based on requirement)
            next();
        }
    }
}
