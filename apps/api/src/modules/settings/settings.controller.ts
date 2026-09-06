import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { Authenticated } from '../../common/decorators/auth.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { requireClinicId } from '../../common/tenant/clinic-context';

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
