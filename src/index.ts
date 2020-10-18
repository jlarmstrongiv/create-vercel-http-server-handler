import { AddressInfo } from 'net';
import { NowRequest, NowResponse } from '@vercel/node';
import http from 'http';
import https from 'https';
import HttpProxy from 'http-proxy';

// https://stackoverflow.com/a/63629410
let cache = false;
let cachedServer: http.Server;
let cachedProxy: HttpProxy;

const start = async (app: http.Server, port: number): Promise<void> => {
  return new Promise((resolve, _reject) => {
    cache = true;
    cachedServer = app.listen(port, () => {
      resolve();
    });
    cachedProxy = new HttpProxy();
  });
};

// currying, must be synchronous https://javascript.info/currying-partials
export default function createVercelHttpServerHandler(
  bootstrap: () => Promise<http.Server>,
  enableCache: boolean
) {
  // https://vercel.com/docs/runtimes#official-runtimes/node-js/node-js-request-and-response-objects
  return async function handler(req: NowRequest, res: NowResponse) {
    if (!cache && enableCache) await start(await bootstrap(), 0);

    // https://stackoverflow.com/a/61732185
    return new Promise(async (resolve, reject) => {
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
