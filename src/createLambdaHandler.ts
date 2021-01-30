import { Handler, Context } from 'aws-lambda';
import { Server } from 'http';
import { createServer, proxy } from 'aws-serverless-express';
import { eventContext } from 'aws-serverless-express/middleware';

import { NestFactory } from '@nestjs/core';
import {
  ExpressAdapter,
  NestExpressApplication,
} from '@nestjs/platform-express';
import { BootstrapOptions } from './bootstrap';
import express from 'express';

// NOTE: If you get ERR_CONTENT_DECODING_FAILED in your browser, this
// is likely due to a compressed response (e.g. gzip) which has not
// been handled correctly by aws-serverless-express and/or API
// Gateway. Add the necessary MIME types to binaryMimeTypes below

// https://github.com/awslabs/aws-serverless-express/blob/master/examples/basic-starter/lambda.js
const binaryMimeTypes: string[] = [
  'application/javascript',
  'application/json',
  'application/octet-stream',
  'application/xml',
  'font/eot',
  'font/opentype',
  'font/otf',
  'image/gif',
  'image/heic',
  'image/jpeg',
  'image/png',
  'image/svg+xml',
  'image/webp',
  'text/comma-separated-values',
  'text/css',
  'text/html',
  'text/javascript',
  'text/plain',
  'text/text',
  'text/xml',
];

let cachedServer: Server;

// Create the Nest.js server and convert it into an Express.js server
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

    nestApp.use(eventContext());

    // custom add global pipes, filters, interceptors, etc.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    if (useGlobal) await useGlobal(nestApp);

    await nestApp.init();
    cachedServer = createServer(expressApp, undefined, binaryMimeTypes);
  }
  return cachedServer;
}

export function createLambdaHandler(
  bootstrapNestOptions: BootstrapOptions
): Handler {
  // Export the handler : the entry point of the Lambda function
  return async function Handler(event: any, context: Context) {
    // https://medium.com/safara-engineering/wiring-up-typeorm-with-serverless-5cc29a18824f
    context.callbackWaitsForEmptyEventLoop = false;
    cachedServer = await bootstrapServer(bootstrapNestOptions);
    return proxy(cachedServer, event, context, 'PROMISE').promise;
  };
}
