import http from 'http';
import { Express } from 'express';

export interface BootstrapExpressOptions {
  app: Express;
}
export function bootstrapExpress({ app }: BootstrapExpressOptions) {
  return async function bootstrapExpressHandler() {
    // console.log('[createVercelHttpServerHandler]: bootstrapExpress');
    return {
      server: http.createServer(app),
      app,
      type: 'EXPRESS',
    };
  };
}
