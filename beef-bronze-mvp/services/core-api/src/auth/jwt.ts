import { SignJWT, importPKCS8, importSPKI, jwtVerify, type CryptoKey } from 'jose';
import type { Tier } from '@beef/contracts';

/**
 * ES256 access tokens. Only core-api holds the private key; game-engine,
 * chat, matchmaking and safety verify with the public key, so no other
 * service can mint a token (an improvement over a shared HS256 secret).
 */
export class TokenService {
  private constructor(
    private readonly priv: CryptoKey,
    private readonly pub: CryptoKey,
  ) {}

  static async create(privatePem: string, publicPem: string): Promise<TokenService> {
    return new TokenService(await importPKCS8(privatePem, 'ES256'), await importSPKI(publicPem, 'ES256'));
  }

  sign(userId: string, tier: Tier): Promise<string> {
    return new SignJWT({ tier })
      .setProtectedHeader({ alg: 'ES256', kid: 'beef-1' })
      .setSubject(userId)
      .setIssuer('beef-core')
      .setAudience('beef')
      .setIssuedAt()
      .setExpirationTime('7d') // Bronze. Silver: 15 min access + rotating refresh tokens.
      .sign(this.priv);
  }

  async verify(token: string): Promise<{ userId: string; tier: Tier }> {
    const { payload } = await jwtVerify(token, this.pub, { issuer: 'beef-core', audience: 'beef', algorithms: ['ES256'] });
    if (!payload.sub) throw new Error('token has no subject');
    return { userId: payload.sub, tier: (payload.tier as Tier) ?? 'V0' };
  }
}

export const TOKENS = Symbol('TOKENS');
