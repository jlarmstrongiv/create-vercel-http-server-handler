import http from 'http';
import express from 'express';

export function bootstrapExpress(app: express.Express) {
  return async function bootstrapExpressHandler() {
    console.log('[createVercelHttpServerHandler]: bootstrapExpress');
    return http.createServer(app);
  };
}
