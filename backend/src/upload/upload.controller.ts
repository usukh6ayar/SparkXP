import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums';
import { ImageStorageService } from '../ai-gateway/image-storage.service';

const ALLOWED_IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const ALLOWED_VIDEO_EXT = ['.mp4', '.mov', '.webm', '.m4v'];
const ALLOWED_AUDIO_EXT = ['.mp3', '.m4a', '.wav', '.ogg', '.aac'];
const ALLOWED_MODEL_EXT = ['.glb', '.gltf']; // 3D avatars → Cloudflare R2
const MAX_SIZE_IMAGE = 10 * 1024 * 1024; // 10 MB
const MAX_SIZE_MODEL = 200 * 1024 * 1024; // 200 MB
const MAX_SIZE_VIDEO = 200 * 1024 * 1024; // 200 MB

/** Correct MIME for GLB/GLTF (multer often reports octet-stream). */
function modelMime(ext: string, fallback: string): string {
  if (ext === '.glb') return 'model/gltf-binary';
  if (ext === '.gltf') return 'model/gltf+json';
  return fallback;
}

function fileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) {
  const ext = extname(file.originalname).toLowerCase();
  if (
    [
      ...ALLOWED_IMAGE_EXT,
      ...ALLOWED_VIDEO_EXT,
      ...ALLOWED_AUDIO_EXT,
      ...ALLOWED_MODEL_EXT,
    ].includes(ext)
  ) {
    cb(null, true);
  } else {
    cb(new BadRequestException(`Зөвшөөрөгдөөгүй файлын төрөл: ${ext}`), false);
  }
}

@Controller('upload')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
export class UploadController {
  constructor(private readonly storage: ImageStorageService) {}

  /**
   * Upload an image / audio / video and get back a public URL. Files are stored
   * via ImageStorageService — Cloudinary when configured (CLOUDINARY_*),
   * otherwise the local `uploads/` folder. Reading the file into memory keeps
   * one code path for both targets (no host-local disk dependency in prod).
   * Max: 10 MB image, 200 MB video/audio.
   */
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter,
      limits: { fileSize: MAX_SIZE_VIDEO },
    }),
  )
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Файл илгээгдээгүй байна');

    const ext = extname(file.originalname).toLowerCase();
    const isImage = ALLOWED_IMAGE_EXT.includes(ext);
    const isVideo = ALLOWED_VIDEO_EXT.includes(ext);
    const isAudio = ALLOWED_AUDIO_EXT.includes(ext);
    const isModel = ALLOWED_MODEL_EXT.includes(ext);

    if (isImage && file.size > MAX_SIZE_IMAGE) {
      throw new BadRequestException('Зургийн хэмжээ 10 MB-аас бага байх ёстой');
    }
    if (isModel && file.size > MAX_SIZE_MODEL) {
      throw new BadRequestException('3D загварын хэмжээ 200 MB-аас бага байх ёстой');
    }

    const filename = `${randomUUID()}${ext}`;
    const url = await this.storage.storeMedia({
      buffer: file.buffer,
      filename,
      // GLB/GLTF: force the correct model MIME (multer reports octet-stream).
      mimeType: isModel ? modelMime(ext, file.mimetype) : file.mimetype,
      // model/audio/video/image all go to R2 when configured (see ImageStorageService).
      resourceType: isModel ? 'model' : isImage ? 'image' : isAudio ? 'audio' : 'video',
      localSubdir: isModel ? 'models' : 'media',
      folder: isModel ? 'buddy/models' : 'uploads',
    });

    return {
      url,
      filename,
      originalName: file.originalname,
      size: file.size,
      type: isImage
        ? 'image'
        : isVideo
          ? 'video'
          : isAudio
            ? 'audio'
            : isModel
              ? 'model'
              : 'file',
    };
  }
}
