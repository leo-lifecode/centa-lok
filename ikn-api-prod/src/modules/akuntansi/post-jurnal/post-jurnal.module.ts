import { Module } from '@nestjs/common';
import { PostJurnalService } from './post-jurnal.service';
import { PostJurnalController } from './post-jurnal.controller';
import { HelperGlobal } from '@src/common/utils/helper/helper';
import { RawMaterialService } from '@src/modules/gudang/raw-material/raw-material.service';
import { ShareModuleService } from '@src/modules/share-module/share-module.service';

@Module({
	controllers: [PostJurnalController],
	providers: [HelperGlobal, PostJurnalService, RawMaterialService, ShareModuleService],
})
export class PostJurnalModule {}
