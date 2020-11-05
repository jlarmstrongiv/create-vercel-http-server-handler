import { NextApiRequest, NextApiResponse } from 'next';
import http from 'http';
import https from 'https';
import HttpProxy from 'http-proxy';
import getRawBody from 'raw-body';
import getPort from 'get-port';
import waitOn from 'wait-on';

import { Express } from 'express';
import { INestApplication } from '@nestjs/common';

// https://www.jeremydaly.com/reuse-database-connections-aws-lambda/
let cache = false;
let cachedPort: number | undefined;
let cachedApp: INestApplication | Express | undefined;
let cachedAppType: string | undefined;
let cachedServer: http.Server | undefined;
let cachedServerAddress: string | undefined;

interface Config {
  bootstrap: () => Promise<{
    server: http.Server;
    app: INestApplication | Express;
    type: string;
  }>;
  enableCache?: boolean;
  NODE_ENV?: string;
  NEST_PORT?: number;
}
// https://stackoverflow.com/a/63629410
const start = async (config: Config): Promise<void> => {
  return new Promise<void>(async (resolve, _reject) => {
    if (cache && config.enableCache) return resolve();

    if (config.NODE_ENV === 'development' && config.NEST_PORT) {
      cache = true;
      cachedServerAddress = `http://localhost:${config.NEST_PORT}`;
      return resolve();
    }

    const [port, { server, app, type }] = await Promise.all([
      getPort(),
      config.bootstrap(),
    ]);
    cache = true;
    cachedPort = port;
    cachedApp = app;
    cachedAppType = type;
    cachedServer = server.listen(port, () => {
      cachedServerAddress =
        (cachedServer instanceof https.Server ? 'https' : 'http') +
        '://127.0.0.1:' +
        cachedPort;
      resolve();
    });
  });
};

// currying, must be synchronous https://javascript.info/currying-partials
export function createVercelHttpServerHandler(config: Config) {
  // default enableCache to true
  if (config.enableCache === undefined) config.enableCache = true;

  // https://vercel.com/docs/runtimes#official-runtimes/node-js/node-js-request-and-response-objects
  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    const [rawBody] = await Promise.all([getRawBody(req), start(config)]);
    // https://stackoverflow.com/a/61732185
    return new Promise(async (resolve, _reject) => {
      const cachedProxy = new HttpProxy();

      cachedProxy.on('proxyReq', function(proxyReq) {
        // https://gist.github.com/NickNaso/96aaad34e305823b9ff6ba3909908f31
        // https://github.com/http-party/node-http-proxy/issues/1471#issuecomment-683484691
        // https://github.com/http-party/node-http-proxy/issues/1279#issuecomment-429378935
        // https://github.com/http-party/node-http-proxy/issues/1142#issuecomment-282810543
        proxyReq.setHeader('content-length', Buffer.byteLength(rawBody));
        proxyReq.write(rawBody);
      });

      cachedProxy.on('proxyRes', async function() {
        // https://stackoverflow.com/a/56835387
        if (!config.enableCache && cache) {
          // close server
          if (cachedServer) {
            await new Promise((resolve, reject) =>
              cachedServer!.close(() => {
                resolve();
              })
            );
          }
          // call shutdown hooks
          if (cachedAppType === 'NEST' && cachedApp) {
            await (cachedApp as INestApplication).close();
          }
          // clear cache
          cache = false;
          cachedPort = undefined;
          cachedApp = undefined;
          cachedAppType = undefined;
          cachedServer = undefined;
          cachedServerAddress = undefined;
        }
        resolve();
      });

      cachedProxy.on('error', function(_error, _req, _res) {
        console.log(_error);
        resolve();
      });

      if (config.NEST_PORT) {
        await waitOn({
          resources: [`tcp:${config.NEST_PORT}`],
        });
      }

      cachedProxy.web(req, res, {
        target: cachedServerAddress,
      });
    });
  };
}
