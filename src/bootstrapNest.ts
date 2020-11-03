import http from 'http';
import express from 'express';
import { NestFactory } from '@nestjs/core';
import { INestApplication } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';

export function bootstrapNest(
  AppModule: any,
  useGlobal?: (app: INestApplication) => Promise<void>
) {
  return async function bootstrapNestHandler() {
    // console.log('[createVercelHttpServerHandler]: bootstrapNest');
    const expressApp = express();
    const nestApp = await NestFactory.create(
      AppModule,
      new ExpressAdapter(expressApp)
    );
    // eslint-disable-next-line react-hooks/rules-of-hooks
    if (useGlobal) await useGlobal(nestApp);
    await nestApp.init();
    return http.createServer(expressApp);
  };
}
