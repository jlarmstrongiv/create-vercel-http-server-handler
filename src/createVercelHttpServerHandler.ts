import { NextApiRequest, NextApiResponse } from 'next';
import http from 'http';
import https from 'https';
import HttpProxy from 'http-proxy';
import getRawBody from 'raw-body';
import getPort from 'get-port';

// https://www.jeremydaly.com/reuse-database-connections-aws-lambda/
let cache = false;
let cachedPort: number;
let cachedServer: http.Server;
let cachedServerAddress: string;

// https://stackoverflow.com/a/63629410
const start = async (
  bootstrap: () => Promise<http.Server>,
  enableCache?: boolean
): Promise<void> => {
  return new Promise<void>(async (resolve, _reject) => {
    if (cache && enableCache) resolve();

    // console.log('[create-vercel-http-server-handler]: start');
    const [port, app] = await Promise.all([getPort(), bootstrap()]);
    cache = true;
    cachedPort = port;
    cachedServer = app.listen(port, () => {
      cachedServerAddress =
        cachedServer instanceof https.Server
          ? 'https'
          : 'http' + '://127.0.0.1:' + cachedPort;
      resolve();
    });
  });
};

// currying, must be synchronous https://javascript.info/currying-partials
export function createVercelHttpServerHandler(
  bootstrap: () => Promise<http.Server>,
  enableCache: boolean
) {
  // https://vercel.com/docs/runtimes#official-runtimes/node-js/node-js-request-and-response-objects
  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    const [rawBody] = await Promise.all([
      getRawBody(req),
      start(bootstrap, enableCache),
    ]);
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

      cachedProxy.on('proxyRes', function() {
        resolve();
      });

      cachedProxy.on('error', function(_error, _req, _res) {
        console.log(_error);
        resolve();
      });

      cachedProxy.web(req, res, { target: cachedServerAddress });
    });
  };
}
