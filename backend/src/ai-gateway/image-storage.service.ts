import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createHash } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

interface StoreImageInput {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  folder?: string;
  localSubdir?: string;
  /** `model` (GLB/GLTF 3D assets) go to Cloudflare R2; image/video to Cloudinary. */
  resourceType?: 'image' | 'video' | 'model';
}

interface CloudinaryUploadResponse {
  secure_url?: string;
  error?: { message?: string };
}

@Injectable()
export class ImageStorageService {
  constructor(private readonly config: ConfigService) {}

  async storeGeneratedImage(input: StoreImageInput): Promise<string> {
    return this.storeMedia({
      ...input,
      localSubdir: input.localSubdir ?? 'generated',
      resourceType: 'image',
    });
  }

  async storeMedia(input: StoreImageInput): Promise<string> {
    // 3D model assets (GLB/GLTF) go to Cloudflare R2 — cheap, zero-egress, and
    // Cloudinary has no benefit for raw binaries. Falls back to local in dev.
    if (input.resourceType === 'model') {
      if (this.hasR2Config()) return this.uploadToR2(input);
      return this.storeLocal(input);
    }

    if (this.hasCloudinaryConfig()) {
      return this.uploadToCloudinary(input);
    }

    return this.storeLocal(input);
  }

  private hasR2Config(): boolean {
    return Boolean(
      this.config.get<string>('R2_ENDPOINT') &&
        this.config.get<string>('R2_ACCESS_KEY_ID') &&
        this.config.get<string>('R2_SECRET_ACCESS_KEY') &&
        this.config.get<string>('R2_BUCKET') &&
        this.config.get<string>('R2_PUBLIC_BASE_URL'),
    );
  }

  /** Upload a file to Cloudflare R2 (S3-compatible) and return its public URL. */
  private async uploadToR2(input: StoreImageInput): Promise<string> {
    const endpoint = this.config.getOrThrow<string>('R2_ENDPOINT');
    const bucket = this.config.getOrThrow<string>('R2_BUCKET');
    const publicBase = this.config.getOrThrow<string>('R2_PUBLIC_BASE_URL');
    const folder = input.folder ?? this.config.get<string>('R2_FOLDER', 'englishxp/models');
    const key = `${folder}/${input.filename}`;

    const client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('R2_ACCESS_KEY_ID'),
        secretAccessKey: this.config.getOrThrow<string>('R2_SECRET_ACCESS_KEY'),
      },
    });

    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: input.buffer,
          ContentType: input.mimeType,
        }),
      );
    } catch (err) {
      throw new InternalServerErrorException(
        `R2 upload failed: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }

    return `${publicBase.replace(/\/$/, '')}/${key}`;
  }

  private hasCloudinaryConfig(): boolean {
    return Boolean(
      this.config.get<string>('CLOUDINARY_CLOUD_NAME') &&
        this.config.get<string>('CLOUDINARY_API_KEY') &&
        this.config.get<string>('CLOUDINARY_API_SECRET'),
    );
  }

  private async uploadToCloudinary(input: StoreImageInput): Promise<string> {
    const cloudName = this.config.getOrThrow<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.config.getOrThrow<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.config.getOrThrow<string>('CLOUDINARY_API_SECRET');
    const assetFolder =
      input.folder ??
      this.config.get<string>('CLOUDINARY_FOLDER', 'englishxp/generated');
    const publicId = input.filename.replace(/\.[^.]+$/, '');
    const resourceType = input.resourceType ?? 'image';
    const timestamp = Math.floor(Date.now() / 1000).toString();

    // overwrite=true so re-generating a word's media replaces the same asset
    // (stable public_id) instead of piling up duplicates in Cloudinary.
    // Signed params must be in alphabetical order.
    const signaturePayload = [
      `asset_folder=${assetFolder}`,
      `overwrite=true`,
      `public_id=${publicId}`,
      `timestamp=${timestamp}`,
    ].join('&');
    const signature = createHash('sha1')
      .update(`${signaturePayload}${apiSecret}`)
      .digest('hex');

    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(input.buffer)], { type: input.mimeType }),
      input.filename,
    );
    form.append('api_key', apiKey);
    form.append('timestamp', timestamp);
    form.append('signature', signature);
    form.append('asset_folder', assetFolder);
    form.append('overwrite', 'true');
    form.append('public_id', publicId);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
      { method: 'POST', body: form },
    );
    const body = (await res.json().catch(() => ({}))) as CloudinaryUploadResponse;

    if (!res.ok || !body.secure_url) {
      throw new InternalServerErrorException(
        body.error?.message ?? 'Cloudinary upload failed',
      );
    }

    return body.secure_url;
  }

  private async storeLocal(input: StoreImageInput): Promise<string> {
    const subdir = input.localSubdir ?? 'generated';
    const relativeDir = join('uploads', subdir);
    const absoluteDir = join(process.cwd(), relativeDir);
    await mkdir(absoluteDir, { recursive: true });
    await writeFile(join(absoluteDir, input.filename), input.buffer);

    const baseUrl =
      this.config.get<string>('PUBLIC_UPLOAD_BASE_URL') ??
      this.config.get<string>('APP_PUBLIC_URL') ??
      `http://localhost:${this.config.get<number>('PORT', 3000)}`;

    return `${baseUrl.replace(/\/$/, '')}/uploads/${subdir}/${input.filename}`;
  }
}
