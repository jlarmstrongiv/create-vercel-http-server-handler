import { AddressInfo } from 'net';
import { NowRequest, NowResponse } from '@vercel/node';
import http from 'http';
import https from 'https';
import HttpProxy from 'http-proxy';
const proxy = new HttpProxy();

// https://stackoverflow.com/a/63629410
let server: http.Server;
const startServer = async (app: http.Server, port: number): Promise<void> => {
  return new Promise((resolve, _reject) => {
    server = app.listen(port, () => {
      resolve();
    });
  });
};

// currying, must be synchronous https://javascript.info/currying-partials
export default function createVercelHttpServerHandler(app: http.Server) {
  // https://vercel.com/docs/runtimes#official-runtimes/node-js/node-js-request-and-response-objects
  return async function handler(req: NowRequest, res: NowResponse) {
    if (!server) await startServer(app, 0);

    // https://stackoverflow.com/a/61732185
    return new Promise(async (resolve, reject) => {
      proxy.on('proxyRes', function() {
        resolve();
      });

      proxy.on('error', function(error, req, res) {
        res.writeHead(500, {
          'Content-Type': 'text/plain',
        });
        res.end('Something went wrong.');
        reject('Something went wrong.');
      });

      // https://github.com/visionmedia/supertest/blob/master/lib/test.js#L61

      // https://stackoverflow.com/a/53749142
      const port = (app.address() as AddressInfo).port;
      const protocol = server instanceof https.Server ? 'https' : 'http';
      const serverAddress = protocol + '://127.0.0.1:' + port;

      proxy.web(req, res, { target: serverAddress });
    });
  };
}
