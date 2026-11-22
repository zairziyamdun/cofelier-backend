import {
  CreateBucketCommand,
  DeleteObjectsCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

export type S3Config = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicUrl: string;
};

// Тонкая обёртка над S3: её зовут и API (StorageService), и сиды — без Nest.
export class S3Storage {
  private readonly client: S3Client;

  constructor(private readonly config: S3Config) {
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      // Путь вида /bucket/key понимают RustFS, MinIO и облачные S3.
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  // Ключи файлов уникальны и не перезаписываются — браузер может кешировать навсегда.
  async put(
    key: string,
    body: Buffer,
    contentType = 'image/webp',
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
  }

  async delete(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.client.send(
      new DeleteObjectsCommand({
        Bucket: this.config.bucket,
        Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
      }),
    );
  }

  publicUrl(key: string): string {
    return `${this.config.publicUrl}/${key}`;
  }

  // Подготовка к работе — для разработки: бакет с открытым чтением.
  prepare(): Promise<void> {
    return this.ensurePublicBucket();
  }

  // Только для разработки: создать бакет и открыть его на чтение. На проде
  // бакет и доступ настраиваются в панели хранилища (docs/DEPLOY.md).
  async ensurePublicBucket(): Promise<void> {
    const bucket = this.config.bucket;
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: bucket }));
      return;
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: bucket }));
    }
    await this.client.send(
      new PutBucketPolicyCommand({
        Bucket: bucket,
        Policy: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${bucket}/*`],
            },
          ],
        }),
      }),
    );
  }
}

// Конфиг из env; null — хранилище не задано (переменные проверены в env.ts).
export function s3ConfigFromEnv(env: {
  S3_ENDPOINT?: string;
  S3_REGION?: string;
  S3_BUCKET?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  S3_PUBLIC_URL?: string;
}): S3Config | null {
  const {
    S3_ENDPOINT,
    S3_BUCKET,
    S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY,
    S3_PUBLIC_URL,
  } = env;
  if (
    !S3_ENDPOINT ||
    !S3_BUCKET ||
    !S3_ACCESS_KEY_ID ||
    !S3_SECRET_ACCESS_KEY ||
    !S3_PUBLIC_URL
  ) {
    return null;
  }
  return {
    endpoint: S3_ENDPOINT,
    region: env.S3_REGION || 'auto',
    bucket: S3_BUCKET,
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
    publicUrl: S3_PUBLIC_URL.replace(/\/+$/, ''),
  };
}
