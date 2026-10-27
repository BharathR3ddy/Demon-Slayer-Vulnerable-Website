import { Options, ReflectMetadataProvider } from '@mikro-orm/core';
import { defineConfig } from '@mikro-orm/postgresql';
import { SqlHighlighter } from '@mikro-orm/sql-highlighter';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrmModuleConfigProperties } from './orm.module.config.properties';

const logger = new Logger('MikroORM');

export class OrmConfigFactory {
  private readonly configService: ConfigService;

  constructor(configService: ConfigService) {
    this.configService = configService;
  }

  public buildConfig(): Options {
    const host = this.configService.get<string>(
      OrmModuleConfigProperties.ENV_DATABASE_HOST
    );

    // Cloud-managed PostgreSQL (Neon, Koyeb, etc.) requires SSL
    // Auto-enable when host matches known cloud providers, or when DATABASE_SSL=true
    const requiresSsl =
      host?.includes('neon.tech') ||
      host?.includes('koyeb.app') ||
      host?.includes('koyeb') ||
      this.configService.get<string>('DATABASE_SSL') === 'true';
    const driverOptions = requiresSsl
      ? { connection: { ssl: { rejectUnauthorized: false } } }
      : {};

    const config = defineConfig({
      entities: ['dist/model'],
      entitiesTs: ['src/model'],
      host,
      dbName: this.configService.get<string>(
        OrmModuleConfigProperties.ENV_DATABASE_SCHEMA
      ),
      user: this.configService.get<string>(
        OrmModuleConfigProperties.ENV_DATABASE_USER
      ),
      password: this.configService.get<string>(
        OrmModuleConfigProperties.ENV_DATABASE_PASSWORD
      ),
      port: this.configService.get<number>(
        OrmModuleConfigProperties.ENV_DATABASE_PORT
      ),
      driverOptions,
      metadataProvider: ReflectMetadataProvider,
      highlighter: new SqlHighlighter(),
      debug:
        this.configService.get<string>(
          OrmModuleConfigProperties.ENV_DATABASE_DEBUG
        ) === 'true',
      logger: logger.log.bind(logger)
    });

    return config;
  }
}
