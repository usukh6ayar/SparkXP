import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';

/** File uploads. Reuses ImageStorageService (Cloudinary / local) from the AI
 *  gateway so admin uploads land in the same place as generated media. */
@Module({
  imports: [AiGatewayModule],
  controllers: [UploadController],
})
export class UploadModule {}
