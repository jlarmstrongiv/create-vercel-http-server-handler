import http from 'http';
import express from 'express';
import { NestFactory } from '@nestjs/core';
import { INestApplication, NestApplicationOptions } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';

export interface BootstrapNestOptions {
  AppModule: any;
  useGlobal?: (app: INestApplication) => Promise<void>;
  nestApplicationOptions?: NestApplicationOptions;
}
export function bootstrapNest({
  AppModule,
  useGlobal,
  nestApplicationOptions = {},
}: BootstrapNestOptions) {
  return async function bootstrapNestHandler() {
    // console.log('[createVercelHttpServerHandler]: bootstrapNest');
    const expressApp = express();
    const nestApp = await NestFactory.create(
      AppModule,
      new ExpressAdapter(expressApp),
      nestApplicationOptions
    );
    // eslint-disable-next-line react-hooks/rules-of-hooks
    if (useGlobal) await useGlobal(nestApp);
    await nestApp.init();
    return {
      server: http.createServer(expressApp),
      app: nestApp,
      type: 'NEST',
    };
  };
}
