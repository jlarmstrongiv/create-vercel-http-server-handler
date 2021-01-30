import { NestExpressApplication } from '@nestjs/platform-express';
import {
  Type,
  DynamicModule,
  ForwardReference,
  NestApplicationOptions,
  INestApplication,
} from '@nestjs/common';

export type AppModule =
  | Type<any>
  | DynamicModule
  | Promise<DynamicModule>
  | ForwardReference<any>;

/**
 * callback to add global filters, guards, interceptors, and pipes
 */
export type UseGlobal = (
  nestApp: INestApplication | NestExpressApplication
) => Promise<INestApplication | NestExpressApplication>;

export type Bootstrap = () => Promise<NestExpressApplication>;

export interface BootstrapNestOptions {
  AppModule: AppModule;
  nestApplicationOptions?: NestApplicationOptions;
  useGlobal?: UseGlobal;
}
