import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HelperGlobal } from '@src/common/utils/helper/helper';
import { SetModuleName } from '@src/shared/guards/module-name.guard';
import { Request } from 'express';
import { CreateRawMaterialIssueDto } from './dto/create-raw-material-issue.dto';
import { CreateRawMaterialDto } from './dto/create-raw-material.dto';
import { GetMaterialDto } from './dto/get-raw-material.dto';
import { UpdateRawMaterialIssueDto } from './dto/update-raw-material.dto';
import { RawMaterialService } from './raw-material.service';
import { UpdateRawMaterialDto } from './dto/update-raw-material.dto';

@Controller({ version: '1' })
@UseGuards(AuthGuard('jwt'))
@SetModuleName('raw-material')
@ApiTags('raw material')
export class RawMaterialController {
	constructor(
		private readonly rawMaterialService: RawMaterialService,
		private readonly helperGlobal: HelperGlobal,
	) {}

	@Post()
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Create Raw Material Penerimaan Barang' })
	@ApiBody({ type: CreateRawMaterialDto })
	create(@Req() req: Request, @Body() createRawMaterialDto: CreateRawMaterialDto) {
		const decoded = this.helperGlobal.decodeJwt(req);
		return this.rawMaterialService.create(createRawMaterialDto, decoded);
	}

	@Post('/pengeluaran')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Create Raw Material Pengeluaran Barang' })
	@ApiBody({ type: CreateRawMaterialIssueDto })
	createIssue(@Req() req: Request, @Body() createRawMaterialDto: CreateRawMaterialIssueDto) {
		const decoded = this.helperGlobal.decodeJwt(req);
		return this.rawMaterialService.createIssue(createRawMaterialDto, decoded);
	}

	@Get()
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Get Raw Material Penerimaan Barang' })
	findAll(@Req() req: Request, @Query() query: GetMaterialDto) {
		const decoded = this.helperGlobal.decodeJwt(req);
		return this.rawMaterialService.findAll(query, decoded);
	}

	@Get('/issue')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Get Raw Material Pengeluaran Barang' })
	findAllIssue(@Query() query: GetMaterialDto) {
		return this.rawMaterialService.findAllIssue(query);
	}

	@Get('/receipt-list')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Get Raw Material Receipt List' })
	getRawMaterialReceiptList(@Query() query: GetMaterialDto) {
		return this.rawMaterialService.getRawMaterialReceiptList(query);
	}

	@Get('/stock-summary/:id')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Get Stock Summary Barang Mentah' })
	findOneStockSummary(@Param('id') id: string) {
		return this.rawMaterialService.findOneStockSummary(id);
	}

	@Get('/issue/:id')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Get Detail Raw Material Pengeluaran' })
	findOneIssue(@Param('id') id: string) {
		return this.rawMaterialService.findOneIssue(id);
	}

	@Get('/raw-card-ware-house/:id')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Get Product for Kartu Gudang' })
	findOneRawProduct(@Param('id') id: string) {
		return this.rawMaterialService.findOneRawProduct(id);
	}

	@Patch('/issue/:id')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Penyesuaian Raw Material Pengeluaran' })
	@ApiBody({ type: UpdateRawMaterialIssueDto })
	updateIssue(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateRawMaterialIssueDto) {
		const decoded = this.helperGlobal.decodeJwt(req);
		return this.rawMaterialService.updateIssue(id, dto, decoded);
	}

	@Post('/issue/:id/post')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Posting Jurnal Pengeluaran Barang Mentah' })
	postIssue(@Req() req: Request, @Param('id') id: string) {
		const decoded = this.helperGlobal.decodeJwt(req);
		return this.rawMaterialService.postIssue(id, decoded);
	}

	@Post('/issue/:id/revert')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Revert Pengeluaran Barang Mentah' })
	revertIssue(@Req() req: Request, @Param('id') id: string) {
		const decoded = this.helperGlobal.decodeJwt(req);
		return this.rawMaterialService.revertIssue(id, decoded);
	}

	@Delete('/issue/:id')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Delete Raw Material Pengeluaran' })
	removeIssue(@Req() req: Request, @Param('id') id: string) {
		const decoded = this.helperGlobal.decodeJwt(req);
		return this.rawMaterialService.removeIssue(id, decoded);
	}

	@Post('/:id/post')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Posting Penerimaan Barang Mentah' })
	postReceipt(@Req() req: Request, @Param('id') id: string) {
		const decoded = this.helperGlobal.decodeJwt(req);
		return this.rawMaterialService.postReceipt(id, decoded);
	}

	@Post('/:id/revert')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Revert Penerimaan Barang Mentah' })
	revertReceipt(@Req() req: Request, @Param('id') id: string) {
		const decoded = this.helperGlobal.decodeJwt(req);
		return this.rawMaterialService.revertReceipt(id, decoded);
	}


	@Patch(':id')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Update Penerimaan Barang Mentah' })
	@ApiBody({ type: UpdateRawMaterialDto })
	updateReceipt(
		@Req() req: Request,
		@Param('id') id: string,
		@Body() dto: UpdateRawMaterialDto,
	) {
		const decoded = this.helperGlobal.decodeJwt(req);
		return this.rawMaterialService.updateReceipt(id, dto, decoded);
	}


	@Get(':id')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Get Raw Material Receipt By ID' })
	findOne(@Param('id') id: string) {
		return this.rawMaterialService.findOne(id);
	}

	@Delete(':id')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Delete Draft Penerimaan Barang Mentah' })
	removeReceipt(@Req() req: Request, @Param('id') id: string) {
		const decoded = this.helperGlobal.decodeJwt(req);
		return this.rawMaterialService.removeReceipt(id, decoded);
	}
}
