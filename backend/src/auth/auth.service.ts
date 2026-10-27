import { EntityManager } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import { HttpClientService } from '../httpclient/httpclient.service';
import { AuthModuleConfigProperties } from './auth.module.config.properties';
import { JwtBearerTokenProcessor } from './jwt/jwt.token.bearer.processor';
import { JwtTokenProcessor } from './jwt/jwt.token.processor';
import { JwtTokenWithJKUProcessor } from './jwt/jwt.token.with.jku.processor';
import { JwtTokenWithJWKProcessor } from './jwt/jwt.token.with.jwk.processor';
import { JwtTokenWithRSAKeysProcessor } from './jwt/jwt.token.with.rsa.keys.processor';
import { JwtTokenWithSqlKIDProcessor } from './jwt/jwt.token.with.sql.kid.processor';
import { JwtTokenWithWeakKeyProcessor } from './jwt/jwt.token.with.weak.key.processor';
import { JwtTokenWithX5CKeyProcessor } from './jwt/jwt.token.with.x5c.key.processor';
import { JwtTokenWithX5UKeyProcessor } from './jwt/jwt.token.with.x5u.key.processor';
import { JwtTokenWithHMACKeysProcessor } from './jwt/jwt.token.with.hmac.keys.processor';
import { JwtTokenWithRSASignatureKeysProcessor } from './jwt/jwt.token.with.rsa.signature.keys.processor';

export enum JwtProcessorType {
  RSA,
  SQL_KID,
  WEAK_KEY,
  X5C,
  X5U,
  JKU,
  JWK,
  BEARER,
  HMAC,
  RSA_SIGNATURE
}

@Injectable()
export class AuthService {
  private processors: Map<JwtProcessorType, JwtTokenProcessor>;

  constructor(
    private readonly configService: ConfigService,
    private readonly em: EntityManager,
    private readonly httpClient: HttpClientService
  ) {
    const resolveKeyPath = (envVar: string, defaultPath: string): string => {
      const configured =
        this.configService.get<string>(envVar) || process.env[envVar];
      if (configured && fs.existsSync(configured)) {
        return configured;
      }
      if (fs.existsSync(defaultPath)) {
        return defaultPath;
      }
      return configured || defaultPath;
    };

    const privateKeyPath = resolveKeyPath(
      AuthModuleConfigProperties.ENV_JWT_PRIVATE_KEY_LOCATION,
      'config/keys/jwtRS256.key'
    );
    const publicKeyPath = resolveKeyPath(
      AuthModuleConfigProperties.ENV_JWT_PUBLIC_KEY_LOCATION,
      fs.existsSync('config/keys/jwtRS256.key.pub.pem')
        ? 'config/keys/jwtRS256.key.pub.pem'
        : 'config/keys/jwtRS256.key.pub'
    );
    const jwkPrivateKeyPath = resolveKeyPath(
      AuthModuleConfigProperties.ENV_JWK_PRIVATE_KEY_LOCATION,
      'config/keys/jwk.key.pem'
    );
    const jwkPublicJsonPath = resolveKeyPath(
      AuthModuleConfigProperties.ENV_JWK_PUBLIC_JSON,
      'config/keys/jwk.pub.json'
    );

    const privateKey = fs.existsSync(privateKeyPath)
      ? fs.readFileSync(privateKeyPath, 'utf8')
      : '';
    const publicKey = fs.existsSync(publicKeyPath)
      ? fs.readFileSync(publicKeyPath, 'utf8')
      : '';
    const jwkPrivateKey = fs.existsSync(jwkPrivateKeyPath)
      ? fs.readFileSync(jwkPrivateKeyPath, 'utf8')
      : '';
    let jwkPublicJson = {};
    if (fs.existsSync(jwkPublicJsonPath)) {
      try {
        jwkPublicJson = JSON.parse(fs.readFileSync(jwkPublicJsonPath, 'utf8'));
      } catch {
        jwkPublicJson = {};
      }
    }

    const jkuUrl =
      this.configService.get<string>(AuthModuleConfigProperties.ENV_JKU_URL) ||
      process.env.JKU_URL ||
      'http://localhost:3000/api/auth/jku';
    const x5uUrl =
      this.configService.get<string>(AuthModuleConfigProperties.ENV_X5U_URL) ||
      process.env.X5U_URL ||
      'http://localhost:3000/api/auth/x5u';
    const jwtSecretKey =
      this.configService.get<string>(
        AuthModuleConfigProperties.ENV_JWT_SECRET_KEY
      ) ||
      this.configService.get<string>('JWT_SECRET') ||
      process.env.JWT_SECRET ||
      process.env.JWT_SECRET_KEY ||
      '1234';

    this.processors = new Map();
    this.processors.set(
      JwtProcessorType.RSA,
      new JwtTokenWithRSAKeysProcessor(publicKey, privateKey)
    );
    this.processors.set(
      JwtProcessorType.SQL_KID,
      new JwtTokenWithSqlKIDProcessor(this.em, jwtSecretKey)
    );
    this.processors.set(
      JwtProcessorType.WEAK_KEY,
      new JwtTokenWithWeakKeyProcessor(jwtSecretKey)
    );
    this.processors.set(
      JwtProcessorType.JKU,
      new JwtTokenWithJKUProcessor(jwkPrivateKey, this.httpClient, jkuUrl)
    );
    this.processors.set(
      JwtProcessorType.JWK,
      new JwtTokenWithJWKProcessor(jwkPrivateKey, jwkPublicJson)
    );
    this.processors.set(
      JwtProcessorType.X5C,
      new JwtTokenWithX5CKeyProcessor(jwkPrivateKey)
    );
    this.processors.set(
      JwtProcessorType.X5U,
      new JwtTokenWithX5UKeyProcessor(jwkPrivateKey, this.httpClient, x5uUrl)
    );

    this.processors.set(
      JwtProcessorType.BEARER,
      new JwtBearerTokenProcessor(jwtSecretKey, null)
    );

    this.processors.set(
      JwtProcessorType.HMAC,
      new JwtTokenWithHMACKeysProcessor(privateKey)
    );
    this.processors.set(
      JwtProcessorType.RSA_SIGNATURE,
      new JwtTokenWithRSASignatureKeysProcessor(publicKey, privateKey)
    );
  }

  validateToken(token: string, processor: JwtProcessorType): Promise<unknown> {
    return this.processors.get(processor).validateToken(token);
  }

  createToken(payload: unknown, processor: JwtProcessorType): Promise<string> {
    return this.processors.get(processor).createToken(payload);
  }
}
