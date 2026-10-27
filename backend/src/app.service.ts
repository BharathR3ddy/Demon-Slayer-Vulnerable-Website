import { HttpException, Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import { ConfigService } from '@nestjs/config';
import { UsersService } from './users/users.service';
import { AppModuleConfigProperties } from './app.module.config.properties';
import { OrmModuleConfigProperties } from './orm/orm.module.config.properties';
import { AppConfig } from './app.config.api';
import { UserDto } from './users/api/UserDto';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UsersService
  ) {}

  async launchCommand(command: string): Promise<string> {
    this.logger.debug(`launch ${command} command`);

    return new Promise((res, rej) => {
      try {
        const [exec, ...args] = command.split(' ');
        const ps = spawn(exec, args);

        ps.stdout.on('data', (data: Buffer) => {
          this.logger.debug(`stdout: ${data}`);
          res(data.toString('ascii'));
        });

        ps.stderr.on('data', (data: Buffer) => {
          this.logger.debug(`stderr: ${data}`);
          res(data.toString('ascii'));
        });

        ps.on('error', (err) => rej(err.message));

        ps.on('close', (code) =>
          this.logger.debug(`child process exited with code ${code}`)
        );
      } catch (err) {
        rej(err.message);
      }
    });
  }

  getConfig(): AppConfig {
    const databaseUrl =
      this.configService.get<string>('DATABASE_URL') ||
      process.env.DATABASE_URL;

    let dbSchema =
      this.configService.get<string>(
        OrmModuleConfigProperties.ENV_DATABASE_SCHEMA
      ) ||
      this.configService.get<string>('DATABASE_NAME') ||
      process.env.DATABASE_NAME ||
      '';
    let dbHost =
      this.configService.get<string>(
        OrmModuleConfigProperties.ENV_DATABASE_HOST
      ) || '';
    let dbPort =
      this.configService.get<string>(
        OrmModuleConfigProperties.ENV_DATABASE_PORT
      ) || '';
    let dbUser =
      this.configService.get<string>(
        OrmModuleConfigProperties.ENV_DATABASE_USER
      ) || '';
    let dbPwd =
      this.configService.get<string>(
        OrmModuleConfigProperties.ENV_DATABASE_PASSWORD
      ) || '';

    if (databaseUrl && (!dbHost || !dbUser)) {
      try {
        const parsed = new URL(databaseUrl);
        dbHost = parsed.hostname;
        dbPort = parsed.port || '5432';
        dbUser = decodeURIComponent(parsed.username);
        dbPwd = decodeURIComponent(parsed.password);
        dbSchema = parsed.pathname.replace(/^\//, '');
      } catch {
        // ignore
      }
    }

    return {
      awsBucket: this.configService.get<string>(
        AppModuleConfigProperties.ENV_AWS_BUCKET
      ),
      sql: databaseUrl || `postgres://${dbUser}:${dbPwd}@${dbHost}:${dbPort}/${dbSchema} `,
      googlemaps: this.configService.get<string>(
        AppModuleConfigProperties.ENV_GOOGLE_MAPS
      )
    };
  }

  async getUserInfo(email: string): Promise<UserDto> {
    try {
      this.logger.debug(`Find a user by email: ${email}`);
      return new UserDto(await this.userService.findByEmail(email));
    } catch (err) {
      throw new HttpException(err.message, err.status);
    }
  }
}
