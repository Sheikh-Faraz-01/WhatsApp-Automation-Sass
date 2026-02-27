import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
  workspaceId: string;
}

export const tenantContext = new AsyncLocalStorage<TenantContext>();
