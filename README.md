# The definitive guide to running servers in Vercel

### Versel’s Philosophy

> It's possible to deploy an Express.js application as a single Serverless Function, but it comes with drawbacks and should only be used as a migration path. Instead, embrace multiple Serverless Functions as you incrementally migrate to the Vercel platform.

### My Philosophy

While there are cases where following Vercel’s approach is beneficial, I disagree with entirely dismissing these frameworks. With frameworks like Express.js and Nest.js, I can:

- keep my application portable among hosting providers (**_No vendor locking_**)
- take advantage of the enormouse ecosystem of existing packages, tools, and features built around these frameworks, without reinventing the wheel each time (**_DRY_**)
- reference many resources to learn, build, and bug fix my application in a large community (**_many resources_**)

The main drawback† is a slightly longer cold start time when initializing the framework and risking the 50MB limit. This package caches your server so this delay will not be an issue in subsequent requests.

## Use cases

This package has three main helper functions:

- createNextHandler (expessjs and nestjs)
- createVercelHandler (nestjs)
- createLambdaHandler (nestjs)

## Next.js

### Install

This quick start assumes you bootstrapped your function with `npx create-next-app project-name`. However, this package should work with any [Zero Config Deployments](https://vercel.com/blog/zero-config).

Install this package via [npm](https://www.npmjs.com/package/create-vercel-http-server-handler),
`npm install create-vercel-http-server-handler`

Be sure you have installed the dependencies of your framework in your project, as this package relies on them.

For Express, `npm install express`

For Nest.js, `npm install @nestjs/core @nestjs/common @nestjs/platform-express`

### Setup

Inside your api folder, create a [catch all API route](https://nextjs.org/docs/api-routes/dynamic-api-routes#catch-all-api-routes). For example, make a file named `[...slug].ts`. Inside that file, import this package:

```ts
import {
  createNextHandler,
  bootstrapExpress,
  bootstrapNest,
} from 'create-vercel-http-server-handler';
```

Export default the handler helper for your framework of choice, and disable the bodyParser.

**Express.js**

```ts
export default createNextHandler({
  bootstrap: bootstrapExpress({ app }),
});

export const config = {
  api: {
    bodyParser: false,
  },
};
```

**Nest.js**

This package expects you to use the default [`@nestjs/platform-express`](https://www.npmjs.com/package/@nestjs/platform-express) under the hood. It will not work with [`@nestjs/platform-fastify`](https://www.npmjs.com/package/@nestjs/platform-fastify). Check out the example on [github](https://github.com/jlarmstrongiv/next-with-nest-graphql).

When using typescript, don’t forget to `npm install --save-dev typescript @types/react @types/node`

Optionally, create a `useGlobal` function for Nest.js to apply any global prefixes, pipes, filters, guards, and interceptors. Because Next.js api routes are all prefixed with `/api`, we recommend you do the same. Only start the server when invoked by the Nest.js CLI. Here is an example `src/main.ts`:

```ts
import { NestFactory } from '@nestjs/core';
import { INestApplication, NestApplicationOptions } from '@nestjs/common';
import { AppModule } from './server/app/app.module';

export const nestApplicationOptions: NestApplicationOptions = {
  logger: false,
};

export async function useGlobal(app: INestApplication) {
  app.setGlobalPrefix('/api');
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await useGlobal(app);
  await app.listen(Number(process.env.NEST_PORT) || 3000);
}
if (process.env.CLI === 'NEST') {
  bootstrap();
}
```

Pass your `AppModule` and optional `useGlobal` function to the `bootstrapNest` helper function inside your `[...slug].ts` api route.

```ts
import {
  createNextHandler,
  bootstrapNest,
} from 'create-vercel-http-server-handler';
import { AppModule } from '../../server/app/app.module';
import { useGlobal, nestApplicationOptions } from '../../main';

export default createNextHandler({
  bootstrap: bootstrapNest({
    AppModule,
    useGlobal,
    nestApplicationOptions,
  }),
  NODE_ENV: process.env.NODE_ENV,
  NEST_PORT: Number(process.env.NEST_PORT),
});

export const config = {
  api: {
    bodyParser: false,
  },
};
```

Nest.js also relies on experimental TypeScript features. Install the required dependencies:

`npm install --save-dev @babel/plugin-transform-runtime babel-plugin-transform-typescript-metadata @babel/plugin-proposal-decorators @babel/plugin-proposal-class-properties`

Enable the experimental TypeScript features with a `.babelrc` file:

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

Edit the `tsconfig.json` for Next.js:

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
  "exclude": ["node_modules", "dist", ".next", ".vercel", "scripts"]
}
```

Add the `tsconfig.nest.json` for Nest.js:

```json
{
  "compilerOptions": {
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,

    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "es2017",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true
  },
  "exclude": ["node_modules", "dist", ".next", ".vercel", "scripts"]
}
```

Don’t forget to install all of Nest.js’ dependencies and dev dependencies. Plus, move relevant scripts, configs, .gitignores, and other files. Consider moving all the server files into `src/server/*` and moving the `main.ts` into `src/main.ts`.

`npm install @nestjs/common @nestjs/core @nestjs/platform-express reflect-metadata rimraf rxjs`

`npm install --save-dev @nestjs/cli @nestjs/schematics @nestjs/testing @types/express @types/jest @types/node @types/supertest @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint eslint-config-prettier eslint-plugin-import jest prettier supertest ts-jest ts-loader ts-node tsconfig-paths typescript`

Update the `nest-cli.json` to reflect the new organization:

```json
{
  "collection": "@nestjs/schematics",
  "sourceRoot": "src/server",
  "compilerOptions": {
    "plugins": ["@nestjs/graphql/plugin"]
  }
}
```

Finally, update the scripts inside the `package.json` and install the required script dependencies:

`npm install --save-dev npm-run-all cross-env wait-on`

```json
{
  "scripts": {
    "predev": "rimraf dist",
    "dev": "npm-run-all -p -r dev:nest dev:next:wait",
    "dev:next": "cross-env NEST_PORT=7000 next dev -p 8000",
    "dev:next:wait": "npm-run-all -s dev:nest:wait dev:next",
    "dev:nest": "cross-env NEST_PORT=7000 CLI=NEST nest start --path ./tsconfig.nest.json --watch --preserveWatchOutput",
    "dev:nest:wait": "wait-on tcp:7000",
    "build": "npm run build:next",
    "build:next": "next build",
    "prebuild:nest": "rimraf dist",
    "build:nest": "cross-env NODE_ENV=production nest build --path ./tsconfig.nest.json",
    "start": "npm run start:next",
    "start:next": "next start -p 8000",
    "start:nest": "cross-env CLI=NEST NEST_PORT=7000 nest start --path ./tsconfig.nest.json",
    "start:nest:prod": "cross-env CLI=NEST NEST_PORT=7000 node dist/main",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
    "test:e2e": "jest --config ./test/jest-e2e.json"
  }
}
```

If you are using graphql, customize the webpack config in `next.config.js` and `npm install --save-dev ts-loader`:

```js
module.exports = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      const tsLoader = {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        options: {
          transpileOnly: true,
          getCustomTransformers: program => ({
            before: [require('@nestjs/graphql/plugin').before({}, program)],
          }),
        },
        exclude: /node_modules/,
      };
      config.module.rules.push(tsLoader);
    }
    return config;
  },
};
```

If you are creating custom scripts, you will need another `tsconfig.scripts.json`:

```json
{
  "compilerOptions": {
    "noEmit": true,

    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,

    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "es2017",
    "sourceMap": true,
    "baseUrl": "./",
    "incremental": true
  },
  "exclude": ["node_modules", "dist", ".next", ".vercel"]
}
```

### Serverless Configuration

For additional configuration, read Vercel’s [docs](https://vercel.com/docs/configuration#project/functions).

**vercel.json**

```json
{
  "version": 2,
  "scope": "your-scope",
  "functions": {
    "src/pages/api/[...slug].ts": {
      "memory": 3008,
      "maxDuration": 60
    }
  }
}
```

### How it works

The first argument of `createNextHandler` is your bootstrap function. The second argument is `enableCache` to cache your server after startup. I recommend using `!!process.env.AWS_REGION` so that your server is cached on Vercel hosting, but will still hot reload properly locally.

Internally, we call `http.createServer(expressApp)` and cache your server after calling `app.listen(port, () => { … });`. We proxy your server by forwarding all of Vercel’s requests via `node-http-proxy`. Essentially, we are running a server inside a serverless function.

## AWS Lambda

### Install

This QuickStart assumes you bootstrapped your function with `nest new project-name`. However, this package should work with any [Zero Config Deployments](https://vercel.com/blog/zero-config).

Install this package via [npm](https://www.npmjs.com/package/create-vercel-http-server-handler), `npm install create-vercel-http-server-handler`

Be sure you have installed the dependencies of your framework in your project, as this package relies on them.

For express, `npm install aws-serverless-express @nestjs/platform-express`

### TypeScript

Edit your `tsconfig.json` file:

```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,

    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "es2017",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true
  }
}
```

### Setup

Inside your source folder, extract all your global app settings into `src/useGlobal.ts`:

```tsx
import helmet from 'helmet';
import { UseGlobal } from 'create-vercel-http-server-handler';

export const useGlobal: UseGlobal = async app => {
  app.use(helmet());

  // only exists in NestExpressApplication
  if ('disable' in app) app.disable('x-powered-by');

  return app;
};
```

Refactor your `src/main.ts` to use the `useGlobal.ts` function:

```tsx
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { useGlobal } from './useGlobal';

async function start() {
  const app = await NestFactory.create(AppModule);
  await useGlobal(app);
  await app.listen(4000);
}
start();
```

Create your `src/lambda.ts` file:

```tsx
import { createLambdaHandler } from 'create-vercel-http-server-handler';
import { AppModule } from './app/app.module';
import { useGlobal } from './useGlobal';

module.exports.handler = createLambdaHandler({
  AppModule,
  useGlobal,
});
```

### Claudia.js

We will deploy our function with Claudia.js. Be sure to follow their setup [instructions](https://claudiajs.com/tutorials/installing.html).

Unfortunately, Claudia.js does not support native modules (which are c++ libraries built for specific NodeJS versions and operating systems), like sharp.js. We will adapt steps from this [guide](https://cuneyt.aliustaoglu.biz/en/using-docker-and-claudia-js-to-deploy-lambda-functions/) to script our own support. Be sure you have docker [installed](https://www.docker.com/get-started).

#### Scripts

Inside `project-name/scripts/claudia-create.sh`:

```bash
docker run -v $PWD:/claudia -v $HOME/.aws:/root/.aws --rm lambci/lambda:build-nodejs12.x /bin/bash -c "\
cd /claudia
rm -rf node_modules
npm install
npm run build
npm run claudia-create
"
```

Inside `project-name/scripts/claudia-update.sh`:

```bash
docker run -v $PWD:/claudia -v $HOME/.aws:/root/.aws --rm lambci/lambda:build-nodejs12.x /bin/bash -c "\
cd /claudia
rm -rf node_modules
npm install
npm run build
npm run claudia-update
"
```

Make the scripts executable by running `chmod +x ./scripts/claudia-create.sh` and `chmod +x ./scripts/claudia-update.sh` in your terminal. You should only need to do this once.

Add these scripts to your `package.json`:

```json
{
  "claudia-create": "claudia create --handler dist/lambda.handler --deploy-proxy-api --region us-east-1 --timeout 29",
  "claudia-update": "claudia update --timeout 29",
  "create": "./scripts/claudia-create.sh",
  "update": "./scripts/claudia-update.sh"
}
```

To run Nest.js locally again, be sure to reinstall your dependencies with `npx rimraf node_modules` and `npm install`. You will need to do this after every deployment.

Finally, you will need to add these fields to your `package.json` for Claudia.js to [behave](https://github.com/claudiajs/claudia/issues/132#issuecomment-364757470) correctly:

```json
{
  "files": ["dist"],
  "main": "lambda.js"
}
```

## Vercel Serverless

This QuickStart assumes you bootstrapped your function with `nest new project-name`. However, this package should work with any [Zero Config Deployments](https://vercel.com/blog/zero-config).

Install this package via [npm](https://www.npmjs.com/package/create-vercel-http-server-handler), `npm install create-vercel-http-server-handler` and `npm install --save-dev vercel`

### **TypeScript**

Edit your `tsconfig.json` file:

```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,

    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "es2017",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true
  }
}
```

### Setup

Inside your source folder, extract all your global app settings into `src/useGlobal.ts`:

```tsx
import helmet from 'helmet';
import { UseGlobal } from 'create-vercel-http-server-handler';

export const useGlobal: UseGlobal = async app => {
  app.use(helmet());

  // only exists in NestExpressApplication
  if ('disable' in app) app.disable('x-powered-by');

  return app;
};
```

Refactor your `src/main.ts` to use the `useGlobal.ts` function:

```tsx
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { useGlobal } from './useGlobal';

async function start() {
  const app = await NestFactory.create(AppModule);
  await useGlobal(app);
  await app.listen(4000);
}
start();
```

Create your `src/vercel.ts` file:

```tsx
import { createVercelHandler } from 'create-vercel-http-server-handler';
import { AppModule } from './app/app.module';
import { useGlobal } from './useGlobal';

export default createVercelHandler({
  AppModule,
  useGlobal,
});
```

### Vercel

Edit your vercel.json file:

```json
{
  "version": 2,
  "cleanUrls": true,
  "rewrites": [
    { "source": "/api/vercel", "destination": "/api/vercel" },
    { "source": "/", "destination": "/api/vercel" },
    { "source": "/:match*", "destination": "/api/vercel" }
  ]
}
```

Add `project-name/api/vercel.js`:

```jsx
import Handler from '../dist/vercel';

export default Handler;

export const config = {
  api: {
    bodyParser: false,
  },
};
```

Run `npx vercel` to setup and deploy your project. Choose the defaults, except for the `Output Directory` option—select `dist`, where Nestjs compiles your code (otherwise you will have an infinite loop with `npx vercel dev`).

To deploy to production, run `npx vercel --prod`. Vercel handles all native dependencies for you automatically.

### Footnotes

† Please note that serverless in general does not scale well when directly connecting to a database like MongoDB or PostgreSQL. Be sure you use [connection pools](https://www.digitalocean.com/docs/databases/postgresql/how-to/manage-connection-pools/#creating-a-connection-pool).

## Thank you

This package would not exist without the help of:

- [TSDX](https://www.npmjs.com/package/tsdx)
- [node-http-proxy](https://www.npmjs.com/package/http-proxy)
