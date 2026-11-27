import { Module } from '@nestjs/common';
import { HelperGlobal } from '@src/common/utils/helper/helper';
import { ShareModuleService } from '@src/modules/share-module/share-module.service';
import { JurnalEntryController } from './jurnal-entry.controller';
import { JurnalEntryService } from './jurnal-entry.service';

@Module({
	controllers: [JurnalEntryController],
	providers: [HelperGlobal, JurnalEntryService, ShareModuleService],
})
export class JurnalEntryModule {}
