import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionService } from './transaction.service';

import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HelperGlobal } from '@src/common/utils/helper/helper';
import { SetModuleName } from '@src/shared/guards/module-name.guard';
import { Request } from 'express';
import { CreateCashOutFlowDto } from './dto/create-transaction-out.dto';
import { GetTransactionDto } from './dto/get-transaction.dto';

@Controller({ version: '1' })
@UseGuards(AuthGuard('jwt'))
@SetModuleName('transaction')
@ApiTags('Transaction')
export class TransactionController {
	constructor(
		private readonly helperGlobal: HelperGlobal,
		private readonly transactionService: TransactionService,
	) {}

	@Post()
	@ApiBearerAuth() //+
	@ApiOperation({ summary: 'Create transaction' })
	create(@Req() req: Request, @Body() createTransactionDto: CreateTransactionDto) {
		const decoded = this.helperGlobal.decodeJwt(req);
		return this.transactionService.create(createTransactionDto, decoded);
	}

	@Post('dollar')
	@ApiBearerAuth() //+
	@ApiOperation({ summary: 'Create transaction' })
	createDollar(@Req() req: Request, @Body() createTransactionDto: CreateTransactionDto) {
		const decoded = this.helperGlobal.decodeJwt(req);
		return this.transactionService.createDollar(createTransactionDto, decoded);
	}

	@Post('/cash-out-flow')
	@ApiBearerAuth() //+
	@ApiOperation({ summary: 'Create transaction Cash Out Flow' })
	createCashOutFLow(@Req() req: Request, @Body() createTransactionDto: CreateCashOutFlowDto) {
		const decoded = this.helperGlobal.decodeJwt(req);
		return this.transactionService.createCashOutFLow(createTransactionDto, decoded);
	}

	@Post('/cash-out-flow-raw-material')
	@ApiBearerAuth() //+
	@ApiOperation({ summary: 'Create transaction Cash Out Flow Raw Material' })
	createCashOutFLowRawMaterial(@Req() req: Request, @Body() createTransactionDto: CreateCashOutFlowDto) {
		const decoded = this.helperGlobal.decodeJwt(req);
		return this.transactionService.createCashOutFLowRawMaterial(createTransactionDto, decoded);
	}

	@Get()
	@ApiBearerAuth() //+
	@ApiOperation({ summary: 'Get transaction' })
	findAll(@Req() req: Request, @Query() query: GetTransactionDto) {
		const decoded = this.helperGlobal.decodeJwt(req);
		return this.transactionService.findAll(query, decoded);
	}

	@Get(':id')
	@ApiBearerAuth() //+
	@ApiOperation({ summary: 'Get transaction by id' })
	findOne(@Param('id') id: string) {
		return this.transactionService.findOne(id);
	}

	@Patch(':id')
	@ApiBearerAuth() //+
	update(@Req() req: Request, @Param('id') id: string, @Body() updateTransactionDto: UpdateTransactionDto) {
		const decoded = this.helperGlobal.decodeJwt(req);
		return this.transactionService.update(id, updateTransactionDto, decoded);
	}

	@Patch('/dollar/:id')
	@ApiBearerAuth() //+
	updateDollar(@Req() req: Request, @Param('id') id: string, @Body() updateTransactionDto: CreateTransactionDto) {
		const decoded = this.helperGlobal.decodeJwt(req);
		return this.transactionService.updateDollar(id, updateTransactionDto, decoded);
	}

	@Patch('cash-out/:id')
	@ApiBearerAuth() //+
	patchCashOutFlow(@Req() req: Request, @Param('id') id: string, @Body() updateTransactionDto: CreateCashOutFlowDto) {
		const decoded = this.helperGlobal.decodeJwt(req);
		// return this.transactionService.update2(id, updateTransactionDto, decoded);
		return this.transactionService.updateCashOutFlow(id, updateTransactionDto, decoded);
	}

	@Patch('cash-out-flow-raw-material/:id')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Update transaction Cash Out Flow Raw Material' })
	updateCashOutFlowRawMaterial(@Req() req: Request, @Param('id') id: string, @Body() updateTransactionDto: CreateCashOutFlowDto) {
		const decoded = this.helperGlobal.decodeJwt(req);
		return this.transactionService.updateCashOutFlowRawMaterial(id, updateTransactionDto, decoded);
	}

	@Delete('cash-out-flow-raw-material/:id')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Remove transaction Cash Out Flow Raw Material' })
	removeCashOutFlowRawMaterial(@Param('id') id: string) {
		return this.transactionService.removeCashOutFlowRawMaterial(id);
	}

	@Delete(':id')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Remove transaction' })
	remove(@Param('id') id: string) {
		return this.transactionService.remove(id);
	}

	@Patch(':id/action-access')
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Update transaction action access' })
	updateActionAccess(@Req() req: Request, @Param('id') id: string, @Body('isActionEnabled') isActionEnabled: boolean) {
		const decoded = this.helperGlobal.decodeJwt(req);

		return this.transactionService.updateActionAccess(id, isActionEnabled, decoded);
	}
}
