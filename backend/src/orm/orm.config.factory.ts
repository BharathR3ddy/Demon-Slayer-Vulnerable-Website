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
    const databaseUrl =
      this.configService.get<string>('DATABASE_URL') ||
      process.env.DATABASE_URL;

    let host = this.configService.get<string>(
      OrmModuleConfigProperties.ENV_DATABASE_HOST
    );
    let port = this.configService.get<number>(
      OrmModuleConfigProperties.ENV_DATABASE_PORT
    );
    let user = this.configService.get<string>(
      OrmModuleConfigProperties.ENV_DATABASE_USER
    );
    let password = this.configService.get<string>(
      OrmModuleConfigProperties.ENV_DATABASE_PASSWORD
    );
    let dbName =
      this.configService.get<string>(
        OrmModuleConfigProperties.ENV_DATABASE_SCHEMA
      ) ||
      this.configService.get<string>('DATABASE_NAME') ||
      process.env.DATABASE_NAME;

    // Parse DATABASE_URL if provided (Neon, Render, Supabase standard)
    if (databaseUrl) {
      try {
        const parsed = new URL(databaseUrl);
        host = parsed.hostname;
        if (parsed.port) {
          port = parseInt(parsed.port, 10);
        }
        if (parsed.username) {
          user = decodeURIComponent(parsed.username);
        }
        if (parsed.password) {
          password = decodeURIComponent(parsed.password);
        }
        const pathDb = parsed.pathname.replace(/^\//, '');
        if (pathDb) {
          dbName = pathDb;
        }
      } catch (e) {
        logger.warn(`Could not parse DATABASE_URL: ${e.message}`);
      }
    }

    // Cloud-managed PostgreSQL (Neon, Render, Koyeb, Supabase) requires SSL
    // Auto-enable when host matches known cloud providers, or when DATABASE_SSL=true
    const requiresSsl =
      databaseUrl?.includes('sslmode=require') ||
      databaseUrl?.includes('neon.tech') ||
      host?.includes('neon.tech') ||
      host?.includes('koyeb.app') ||
      host?.includes('koyeb') ||
      host?.includes('render.com') ||
      this.configService.get<string>('DATABASE_SSL') === 'true' ||
      process.env.DATABASE_SSL === 'true';

    const driverOptions = requiresSsl
      ? { connection: { ssl: { rejectUnauthorized: false } } }
      : {};

    const config = defineConfig({
      entities: ['dist/model'],
      entitiesTs: ['src/model'],
      clientUrl: databaseUrl,
      host,
      dbName: dbName || 'demonslayer',
      user,
      password,
      port: port ? Number(port) : 5432,
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
