import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Req } from '@nestjs/common';
import { JurnalEntryService } from './jurnal-entry.service';
import { CreateJurnalEntryDto } from './dto/create-jurnal-entry.dto';
import { SetModuleName } from '@src/shared/guards/module-name.guard';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetJurnalEntryDto, GetJurnalEntryHeaderDto } from './dto/get-jurnal-entry.dto';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { HelperGlobal } from '@src/common/utils/helper/helper';
import { UpdateteJurnalEntryDto } from './dto/update-jurnal-entry.dto';

@Controller({ version: '1' })
@SetModuleName('jurnal-entry')
@UseGuards(AuthGuard('jwt')) //+
@ApiTags('Jurnal Entry')
export class JurnalEntryController {
	constructor(
		private readonly helperGlobal: HelperGlobal,
		private readonly jurnalEntryService: JurnalEntryService
	) {}

	@Post()
	@ApiBearerAuth() //+
	@ApiOperation({ summary: 'Create jurnal entry' })
	create(@Req() req: Request, @Body() createJurnalEntryDto: CreateJurnalEntryDto) {
		const decoded = this.helperGlobal.decodeJwt(req);
		return this.jurnalEntryService.create(createJurnalEntryDto, decoded);
	}

	@Get()
	@ApiBearerAuth() //+
	@ApiOperation({ summary: 'Get jurnal entry' })
	findAll(@Req() req: Request, @Query() query: GetJurnalEntryDto) {
		const decoded = this.helperGlobal.decodeJwt(req);
		return this.jurnalEntryService.findAll(query, decoded);
	}

	@Get('header')
	@ApiBearerAuth() //+
	@ApiOperation({ summary: 'Get jurnal entry header' })
	findAllJurnalHeader(@Req() req: Request, @Query() query: GetJurnalEntryHeaderDto) {
		const decoded = this.helperGlobal.decodeJwt(req);
		return this.jurnalEntryService.findAllJurnalHeader(query, decoded);
	}

	@Get(':id')
	@ApiBearerAuth() //+
	@ApiOperation({ summary: 'Get jurnal entry By id' })
	findOne(@Param('id') id: string) {
		return this.jurnalEntryService.findOne(id);
	}

	@Patch(':id')
	@ApiBearerAuth() //+
	@ApiBody({ type: UpdateteJurnalEntryDto }) // <-- Ini yang bikin Swagger ngerti array
	@ApiOperation({ summary: 'Update jurnal entry By journalEntryId' })
	update(@Param('id') id: string, @Body() updateJurnalEntryDto: UpdateteJurnalEntryDto) {
		return this.jurnalEntryService.update(id, updateJurnalEntryDto);
	}

	@Delete(':id')
	@ApiBearerAuth() //+
	remove(@Param('id') id: string) {
		return this.jurnalEntryService.remove(id);
	}
}
