import { AddressInfo } from 'net';
import { NextApiRequest, NextApiResponse } from 'next';
import http from 'http';
import https from 'https';
import HttpProxy from 'http-proxy';
import getRawBody from 'raw-body';

// https://stackoverflow.com/a/63629410
let cache = false;
let cachedProxy: HttpProxy;
let cachedServer: http.Server;

const start = async (app: http.Server, port: number): Promise<void> => {
  return new Promise((resolve, _reject) => {
    // console.log('[create-vercel-http-server-handler]: start');
    cache = true;
    cachedProxy = new HttpProxy();
    cachedServer = app.listen(port, () => {
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
    if (!cache || !enableCache) await start(await bootstrap(), 0);

    // https://stackoverflow.com/a/61732185
    return new Promise(async (resolve, reject) => {
      const rawBody = await getRawBody(req);

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

      cachedProxy.on('error', function(_error, _req, res) {
        res.writeHead(500, {
          'Content-Type': 'text/plain',
        });
        res.end('[createVercelHttpServerHandler]: Something went wrong.');
        reject('[createVercelHttpServerHandler]: Something went wrong.');
      });

      // https://github.com/visionmedia/supertest/blob/master/lib/test.js#L61
      // https://stackoverflow.com/a/53749142
      const port = (cachedServer.address() as AddressInfo).port;
      const protocol = cachedServer instanceof https.Server ? 'https' : 'http';
      const serverAddress = protocol + '://127.0.0.1:' + port;

      cachedProxy.web(req, res, { target: serverAddress });
    });
  };
}
