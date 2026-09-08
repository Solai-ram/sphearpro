import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { Authenticated } from '../../common/decorators/auth.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { requireClinicId } from '../../common/tenant/clinic-context';
import { multerImageOptions } from '../../common/upload/multer-options';

@ApiTags('Settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get()
  @Authenticated('settings.view')
  @ApiOperation({ summary: 'List settings' })
  findAll(@CurrentUser() user: { clinicId?: string }, @Query('group') group?: string) {
    return this.settingsService.findAll(requireClinicId(user), group);
  }

  @Get('appearance')
  @ApiOperation({ summary: 'Public UI theme' })
  getAppearance() {
    return this.settingsService.getAppearance();
  }

  @Get('logo')
  @Authenticated('settings.view')
  @ApiOperation({ summary: 'Get clinic letterhead logo URL' })
  getLogo(@CurrentUser() user: { clinicId?: string }) {
    return this.settingsService.getLogoUrl(requireClinicId(user));
  }

  @Post('logo')
  @Authenticated('settings.manage')
  @ApiOperation({ summary: 'Upload clinic letterhead logo' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', multerImageOptions()))
  uploadLogo(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    if (!file) throw new BadRequestException('No file provided');
    return this.settingsService.uploadLogo(requireClinicId(user), file, user.sub);
  }

  @Delete('logo')
  @Authenticated('settings.manage')
  @ApiOperation({ summary: 'Remove clinic letterhead logo' })
  removeLogo(@CurrentUser() user: { sub?: string; clinicId?: string }) {
    return this.settingsService.removeLogo(requireClinicId(user), user.sub);
  }

  @Get('key/:key')
  @Authenticated('settings.view')
  @ApiOperation({ summary: 'Get setting by key' })
  findByKey(@Param('key') key: string, @CurrentUser() user: { clinicId?: string }) {
    return this.settingsService.findByKey(key, requireClinicId(user));
  }

  @Patch()
  @Authenticated('settings.manage')
  @ApiOperation({ summary: 'Upsert settings' })
  upsert(
    @Body() body: { items: Array<{ key: string; value: unknown; group?: string }> },
    @CurrentUser() user: { sub?: string; clinicId?: string },
  ) {
    return this.settingsService.upsertMany(body.items || [], requireClinicId(user), user.sub);
  }
}
