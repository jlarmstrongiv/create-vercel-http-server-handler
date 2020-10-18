# The definitive guide to running servers in Vercel

### Versel’s Philosophy

> It's possible to deploy an Express.js application as a single Serverless Function, but it comes with drawbacks and should only be used as a migration path. Instead, embrace multiple Serverless Functions as you incrementally migrate to the Vercel platform.

### My Philosophy

While there are cases where following Vercel’s approach is beneficial, I disagree wih entirely dismissing these frameworks. With frameworks like Express.js, I can:

- keep my application portable among hosting providers (**_No vendor locking_**)
- take advantage of the enormouse ecosystem of existing packages, tools, and features built around these frameworks, without reinventing the wheel each time (**_DRY_**)
- reference many resources to learn, build, and bugfix my application in a large community (**_many resources_**)

The main drawback† is a slightly longer coldstart time when initializing the framework. This package caches your server so this delay will not be an issue in subsequent requests.

## Quickstart

### Install

This quickstart assumes you bootstraped your function with `npx create-next-app project-name`. However, this package should work with any [Zero Config Deployments](https://vercel.com/blog/zero-config).

Install both this package and node-http-proxy via [npm](https://www.npmjs.com/package/create-vercel-http-server-handler),
`npm install create-vercel-http-server-handler http-proxy`

Be sure you have installed the dependencies of your framework in your project, as this package relies on them.

For Express, `npm install express`

For Nest.js, `npm install @nestjs/core @nestjs/common @nestjs/platform-express`

### Setup

Inside your api folder, create a [catch all API route](https://nextjs.org/docs/api-routes/dynamic-api-routes#catch-all-api-routes). For example, make a file named `[...slug].ts`. Inside that file, import this package:

```ts
import {
  createVercelHttpServerHandler,
  bootstrapExpress,
  bootstrapNest,
} from 'create-vercel-http-server-handler';
```

And export default the handler helper for your framework of choice.

**Express.js**

```ts
export default createVercelHttpServerHandler(
  bootstrapExpress(app),
  !!process.env.AWS_REGION
);
```

**Nest.js**

This package expects you to use the default [`@nestjs/platform-express`](https://www.npmjs.com/package/@nestjs/platform-express) under the hood. It will not work with [`@nestjs/platform-fastify`](https://www.npmjs.com/package/@nestjs/platform-fastify).

Optionally, create a `useGlobal` function for Nest.js to apply any global prefixes, pipes, filters, guards, and interceptors. Because Next.js api routes are all prefixed with `/api`, we recommend you do the same.

```ts
export function useGlobal(app: INestApplication) {
  app.setGlobalPrefix('/api');
}
```

Pass your `AppModule` and optional `useGlobal` function to the `bootstrapNest` helper function.

```ts
export default createVercelHttpServerHandler(
  bootstrapNest(AppModule, useGlobal),
  !!process.env.AWS_REGION
);
```

Nest.js also relies on experimental TypeScript features. Follow these steps to enable them in Next.js.

Install the required dependencies:

`npm install @babel/plugin-transform-runtime babel-plugin-transform-typescript-metadata @babel/plugin-proposal-decorators @babel/plugin-proposal-class-properties`

Don’t forget to install all of Next.js’ dependencies and dev dependencies. Plus, move relevant configs and other files.

Enable them with a `.babelrc` file:

```json
{
  "presets": ["next/babel"],
  "plugins": [
    [
      "@babel/plugin-transform-runtime",
      {
        "regenerator": true
      }
    ],
    "babel-plugin-transform-typescript-metadata",
    ["@babel/plugin-proposal-decorators", { "legacy": true }],
    ["@babel/plugin-proposal-class-properties", { "loose": true }]
  ]
}
```

Edit the `tsconfig.json`:

```json
{
  "compilerOptions": {
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "baseUrl": "./",

    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": false,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve"
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

Add the `tsconfig.build.json`;

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "test", "dist", "**/*spec.ts"]
}
```

### Serverless Configuration

For additional configuration, read Vercel’s [docs](https://vercel.com/docs/configuration#project/functions).

**vercel.json**

```json
{
  "version": 2,
  "scope": "fromtheexchange",
  "functions": {
    "src/pages/api/[...slug].ts": {
      "memory": 3008,
      "maxDuration": 60
    }
  }
}
```

---

**_That’s all folks! Feel free to check out the alternative guide below to learn about another implementation._**

---

## How it works

The first argument of `createVercelHttpServerHandler` is your bootstrap function. The second argument is `enableCache` to cache your server after startup. I recommend using `!!process.env.AWS_REGION` so that your server is cached on Vercel hosting, but will still hot reload properly locally.

Internally, we call `http.createServer(expressApp)` and cache your server after calling `app.listen(port, () => { … });`. We proxy your server by forwarding all of Vercel’s requests via `node-http-proxy`. Essentially, we are running a server inside a serverless function.

## Alternative

If you would rather not use a proxy between your framework and Vercel, you can use their deprecated `@vercel/node` framework instead. This requires your server to be in a standalone project.

Vercel support has said:

> You cannot configure the memory and timeout of your functions if you are opting-out of "Zero Config".

Vercel Pro Plan users can only use a function with:

- Memory Size 1024 MB
- Timeout 60s

Additional unofficial documentation is available [here](https://docs-git-add-config-reference.zeit.now.sh/docs/builders/builders-mdx/advanced/advanced#official-builders/node-js/node-js-request-and-response-objects).

It is important to note that Vercel’s GitHub Deploy Hooks do not work with `@vercel/node` either, as packages will not be installed and build scripts will not run.

In this case, we will disable the GitHub integration and use a husky pre-push hook instead. It is also possible to use [GitHub Actions](https://carlosroso.com/how-to-deploy-a-monorepo-in-vercel/) to automatically deploy on git push.

### vercel.json

First, setup a `vercel.json` file in your project root:

```json
{
  "version": 2,
  "github": {
    "enabled": false
  },
  "builds": [
    {
      "src": "dist/lambda.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "dist/lambda.js"
    }
  ]
}
```

The `builds[].src` and `routes[].dest` properties should be the file that runs the server.

### lambda.js

In this example, we are using `lambda.ts` as the file that runs the server. By using typescript, we introduce a build step. That is why we configured our file path to `dist/lambda.js` above.

If you are using Express.js, your `lambda.ts` file would look like the [basic-starter](https://github.com/awslabs/aws-serverless-express/blob/master/examples/basic-starter/lambda.js) on [`aws-serverless-express`](https://www.npmjs.com/package/aws-serverless-express).

If you are using Next.js, your `lambda.ts` would look similar, except with modifications like:

```ts
import { Handler, Context } from 'aws-lambda';
import { Server } from 'http';
import { createServer, proxy } from 'aws-serverless-express';
import { eventContext } from 'aws-serverless-express/middleware';

import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app/app.module';
import { useGlobal } from './main';

// https://github.com/Microsoft/TypeScript/issues/13340
import express = require('express');

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
  'image/jpeg',
  'image/png',
  'image/svg+xml',
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
async function bootstrapServer(): Promise<Server> {
  if (!cachedServer) {
    const expressApp = express();
    const nestApp = await NestFactory.create(
      AppModule,
      new ExpressAdapter(expressApp)
    );
    nestApp.use(eventContext());

    // custom add global pipes, filters, interceptors, etc.
    useGlobal(nestApp);

    await nestApp.init();
    cachedServer = createServer(expressApp, undefined, binaryMimeTypes);
  }
  return cachedServer;
}

// Export the handler : the entry point of the Lambda function
export const handler: Handler = async (event: any, context: Context) => {
  // https://medium.com/safara-engineering/wiring-up-typeorm-with-serverless-5cc29a18824f
  context.callbackWaitsForEmptyEventLoop = false;
  cachedServer = await bootstrapServer();
  return proxy(cachedServer, event, context, 'PROMISE').promise;
};
```

### Build Step

In order for the build to run, we must make our own build step. We will use a husky pre-push hook. However, it is also possible to use [GitHub Actions](https://carlosroso.com/how-to-deploy-a-monorepo-in-vercel/) to automatically deploy on git push.

To start, we will install these dependencies:

`npm install --save-dev husky npm-run-all vercel`

In our `package.json`, we will add our husky configuration and additional scripts:

```json
{
  "scripts": {
    "git": "git diff HEAD --quiet",
    "deploy": "vercel --prod"
  },
  "husky": {
    "hooks": {
      "pre-push": "npm-run-all -s git build deploy"
    }
  }
}
```

We expect your package to have a build script, but we recommend copying all your scripts from your framework for local development.

Now, we can run our server on `@vercel/node` with automatic deployment.

### Footnotes

† Please note that serverless in general does not scale well when directly connecting to a database like MongoDB or PostgreSQL. These databases have limited connection pools that are exhausted when many lambdas are spun up. Similar concerns can be said about realtime web sockets. You should probably avoid serverless in these use cases. Instead, take a look at alternative scalable hosting solutions like [Google App Engine](https://cloud.google.com/appengine) with [cluster](https://www.npmjs.com/package/cluster).

## Thank you

This package would not exist without the help of:

- [TSDX](https://www.npmjs.com/package/tsdx)
- [node-http-proxy](https://www.npmjs.com/package/http-proxy)
