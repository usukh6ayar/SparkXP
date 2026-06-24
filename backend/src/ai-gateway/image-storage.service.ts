import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

interface StoreImageInput {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  folder?: string;
  localSubdir?: string;
  resourceType?: 'image' | 'video';
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
    if (this.hasCloudinaryConfig()) {
      return this.uploadToCloudinary(input);
    }

    return this.storeLocal(input);
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
