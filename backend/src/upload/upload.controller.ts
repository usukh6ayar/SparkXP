import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums';

const ALLOWED_IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const ALLOWED_VIDEO_EXT = ['.mp4', '.mov', '.webm', '.m4v'];
const ALLOWED_AUDIO_EXT = ['.mp3', '.m4a', '.wav', '.ogg', '.aac'];
const MAX_SIZE_IMAGE = 10 * 1024 * 1024;  // 10 MB
const MAX_SIZE_VIDEO = 200 * 1024 * 1024; // 200 MB

const storage = diskStorage({
  destination: join(process.cwd(), 'uploads'),
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    cb(null, `${randomUUID()}${ext}`);
  },
});

function fileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) {
  const ext = extname(file.originalname).toLowerCase();
  if ([...ALLOWED_IMAGE_EXT, ...ALLOWED_VIDEO_EXT, ...ALLOWED_AUDIO_EXT].includes(ext)) {
    cb(null, true);
  } else {
    cb(new BadRequestException(`Зөвшөөрөгдөөгүй файлын төрөл: ${ext}`), false);
  }
}

@Controller('upload')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
export class UploadController {
  /**
   * Upload an image or video file and get back a public URL.
   * Max: 10 MB image, 200 MB video.
   */
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage,
      fileFilter,
      limits: { fileSize: MAX_SIZE_VIDEO },
    }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    if (!file) throw new BadRequestException('Файл илгээгдээгүй байна');

    const ext = extname(file.filename).toLowerCase();
    const isImage = ALLOWED_IMAGE_EXT.includes(ext);
    const isVideo = ALLOWED_VIDEO_EXT.includes(ext);

    if (isImage && file.size > MAX_SIZE_IMAGE) {
      throw new BadRequestException(`Зургийн хэмжээ 10 MB-аас бага байх ёстой`);
    }

    // Build URL from request host so it works on any machine
    const proto = req.protocol;
    const host = req.get('host') ?? 'localhost:3000';
    const url = `${proto}://${host}/uploads/${file.filename}`;

    return {
      url,
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      type: isImage ? 'image' : isVideo ? 'video' : 'file',
    };
  }
}
