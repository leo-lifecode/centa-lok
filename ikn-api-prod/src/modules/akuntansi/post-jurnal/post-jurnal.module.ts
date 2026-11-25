import { Module } from '@nestjs/common';
import { PostJurnalService } from './post-jurnal.service';
import { PostJurnalController } from './post-jurnal.controller';
import { HelperGlobal } from '@src/common/utils/helper/helper';

@Module({
	controllers: [PostJurnalController],
	providers: [HelperGlobal, PostJurnalService],
})
export class PostJurnalModule {}
