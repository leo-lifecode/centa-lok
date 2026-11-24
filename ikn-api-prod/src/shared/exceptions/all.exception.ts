import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { AbstractHttpAdapter } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { ErrorResponse } from '@shared/types/responses';
import { toFriendlyMessage } from '@shared/utils/friendly-message';
import { PrismaErrorCode } from '@shared/utils/prisma.errorCode';
import { AxiosError } from 'axios';

export function UseAllExceptionsFilter(httpAdapterHost: AbstractHttpAdapter) {
	@Catch()
	class AllExceptionsFilter implements ExceptionFilter {
		constructor(public readonly httpAdapterHost: AbstractHttpAdapter) {}

		public readonly logger = new Logger(AllExceptionsFilter.name);

		catch(exception: unknown, host: ArgumentsHost) {
			const httpAdapter = this.httpAdapterHost;
			const ctx = host.switchToHttp();

			const responseBody: ErrorResponse = {
				type: ctx.getRequest().url,
				title: ctx.getRequest().moduleName || 'Internal Server Error',
				status: HttpStatus.INTERNAL_SERVER_ERROR,
				success: false,
				message: 'An unexpected server error occurred',
			};

			console.log(exception);

			// Global exception
			if (exception instanceof HttpException) {
				responseBody.status = exception.getStatus();
				responseBody.message = exception.getResponse()['message'] || exception.message;
			}

			// Axios exception
			if (exception instanceof AxiosError) {
				const { response, message } = exception;
				const { status, data } = response;
				responseBody.status = status || HttpStatus.INTERNAL_SERVER_ERROR;
				responseBody.message = data.message || message;
			}

			// Prisma exception
			if (exception instanceof Prisma.PrismaClientKnownRequestError) {
				const { BAD_REQUEST, CONFLICT, NOT_FOUND } = PrismaErrorCode;
				const code = exception.code;
				if (Object.keys(BAD_REQUEST).includes(code)) {
					responseBody.status = HttpStatus.BAD_REQUEST;
					responseBody.message = BAD_REQUEST[code];
				} else if (Object.keys(CONFLICT).includes(code)) {
					responseBody.status = HttpStatus.CONFLICT;
					responseBody.message = CONFLICT[code];
				} else if (Object.keys(NOT_FOUND).includes(code)) {
					responseBody.status = HttpStatus.NOT_FOUND;
					responseBody.message = NOT_FOUND[code];
				} else {
					responseBody.message = 'An unexpected database error occurred';
					responseBody.status = HttpStatus.INTERNAL_SERVER_ERROR;
				}
			}
			this.logger.error(`Message: ${JSON.stringify(responseBody.message)}, Status: ${responseBody.status}`);
			responseBody.message = toFriendlyMessage(responseBody.message);
			httpAdapter.reply(ctx.getResponse(), responseBody, responseBody.status);
		}
	}

	return new AllExceptionsFilter(httpAdapterHost);
}
