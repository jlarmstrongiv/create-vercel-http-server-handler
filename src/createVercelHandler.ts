import { Server, createServer } from 'http';
import { NestFactory } from '@nestjs/core';
import {
  ExpressAdapter,
  NestExpressApplication,
} from '@nestjs/platform-express';
import express from 'express';
import HttpProxy from 'http-proxy';
import getRawBody from 'raw-body';
import getPort from 'get-port';
import queryString from 'query-string';
import { VercelApiHandler } from '@vercel/node';
import { BootstrapOptions } from './bootstrap';

let cachedServer: Server;
async function bootstrapServer({
  AppModule,
  useGlobal,
  nestApplicationOptions,
}: BootstrapOptions): Promise<Server> {
  if (!cachedServer) {
    const expressApp = express();
    const nestApp = await NestFactory.create<NestExpressApplication>(
      AppModule,
      new ExpressAdapter(expressApp),
      nestApplicationOptions
    );

    // custom add global pipes, filters, interceptors, etc.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    if (useGlobal) await useGlobal(nestApp);

    await nestApp.init();

    cachedServer = createServer(expressApp);
  }
  return cachedServer;
}

let cachedServerAddress: string;
let cachedServerListener: Server;
async function start(bootstrapNestOptions: BootstrapOptions): Promise<string> {
  return new Promise(async (resolve, _reject) => {
    if (!cachedServerAddress) {
      const [port, server] = await Promise.all([
        getPort(),
        bootstrapServer(bootstrapNestOptions),
      ]);

      cachedServerListener = server.listen(port, () => {
        cachedServerAddress =
          (cachedServerListener instanceof Server ? 'http' : 'https') +
          '://127.0.0.1:' +
          port;
        resolve(cachedServerAddress);
      });
    } else {
      resolve(cachedServerAddress);
    }
  });
}

export function createVercelHandler(
  bootstrapNestOptions: BootstrapOptions
): VercelApiHandler {
  return async function handler(req, res): Promise<void> {
    const [rawBody, serverAddress] = await Promise.all([
      getRawBody(req),
      start(bootstrapNestOptions),
    ]);
    // API resolved without sending a response
    // https://stackoverflow.com/a/61732185
    return new Promise(
      async (resolve, _reject): Promise<void> => {
        // remove "match" from vercel rewrites
        const parsedUrl = queryString.parseUrl(req.url || '');
        delete parsedUrl.query.match;
        req.url = queryString.stringifyUrl(parsedUrl);

        const proxy = new HttpProxy();

        proxy.on('proxyReq', function(proxyReq) {
          // https://gist.github.com/NickNaso/96aaad34e305823b9ff6ba3909908f31
          // https://github.com/http-party/node-http-proxy/issues/1471#issuecomment-683484691
          // https://github.com/http-party/node-http-proxy/issues/1279#issuecomment-429378935
          // https://github.com/http-party/node-http-proxy/issues/1142#issuecomment-282810543
          proxyReq.setHeader('content-length', Buffer.byteLength(rawBody));
          proxyReq.write(rawBody);
        });

        proxy.on('proxyRes', async function() {
          resolve();
        });

        proxy.on('error', function(error, _req, _res) {
          console.log(error);
          resolve();
        });

        proxy.web(req, res, {
          target: serverAddress,
        });
      }
    );
  };
}
