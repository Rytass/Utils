import {
  BadRequestException,
  Logger,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  Type,
  UseFilters,
  UseGuards,
  applyDecorators,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  BaseTurnkeyInvoiceEntity,
  TurnkeyEvent,
  TurnkeyEventService,
  TurnkeyIdempotencyService,
  TurnkeyInvoiceIssueInput,
  TurnkeyInvoiceService,
  TurnkeyInvoiceTrackEntity,
  TurnkeyInvoiceTrackService,
  TurnkeySubmissionEntity,
  TurnkeySubmissionService,
  TurnkeySubmissionStatus,
  TurnkeyTrackRegisterInput,
  TurnkeyAllowanceEntity,
  TurnkeyAllowanceIssueInput,
  TurnkeyAllowanceService,
  TurnkeyBlankNumberReport,
  TurnkeyInvoicePrintService,
  TurnkeyProof,
  TurnkeyProofFormat,
  TurnkeyInvoiceNumberEntity,
  TurnkeyMigMessageType,
  TurnkeyReceivedDocumentEntity,
  TurnkeyReceivedDocumentService,
  TurnkeyReceivedDocumentStatus,
  TurnkeyReplyAction,
  isMobileBarcodeFormatValid,
  isNpoCodeFormatValid,
} from '@rytass/invoice-turnkey-base-nestjs-module';
import { createCompanyAccessGuard } from './turnkey-company-access.guard';
import { TurnkeyExceptionFilter } from './turnkey-exception.filter';
import { TurnkeyApiAction, TurnkeyRouteAccess } from './turnkey-rest.options';

export type TurnkeyIssueInvoiceBody = Omit<TurnkeyInvoiceIssueInput, 'companyTaxId' | 'issuedAt'> & {
  readonly issuedAt?: string;
};

/** 回覆收到的文件：同一號碼可能來自不同賣方，跨期也可能重複，所以必須指定賣方統編 */
export interface TurnkeyReceivedReplyBody {
  readonly sellerTaxId?: string;
  /** yyyyMMdd；同一賣方同一號碼有多份時必填 */
  readonly documentDate?: string;
  readonly reason?: string;
  readonly remark?: string;
}

export interface TurnkeyVoidInvoiceBody {
  readonly reason: string;
  readonly remark?: string;
}

export type TurnkeyIssueAllowanceBody = Omit<TurnkeyAllowanceIssueInput, 'companyTaxId' | 'allowanceDate'> & {
  readonly allowanceDate?: string;
};

export type TurnkeyRegisterTrackBody = Omit<TurnkeyTrackRegisterInput, 'companyTaxId'>;

const requireIdempotencyKey = (key: string | undefined): string => {
  if (!key || key.length > 255) throw new BadRequestException('Idempotency-Key header is required (max 255 chars)');

  return key;
};

const parseDate = (value: string | undefined, field: string): Date | undefined => {
  if (value === undefined) return undefined;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) throw new BadRequestException(`${field} must be an ISO 8601 date`);

  return date;
};

const assertObject = (body: unknown): void => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('JSON body is required');
};

const parseProofFormat = (format: unknown): TurnkeyProofFormat => {
  if (format !== undefined && format !== null && typeof format !== 'string') {
    throw new BadRequestException('Unknown proof format');
  }

  const value = (format ?? TurnkeyProofFormat.JSON).toUpperCase();

  if (!Object.values(TurnkeyProofFormat).includes(value as TurnkeyProofFormat)) {
    throw new BadRequestException('Unknown proof format');
  }

  return value as TurnkeyProofFormat;
};

/** 查詢筆數：省略時 100，必須是 1–500 的整數 */
const parseLimit = (limit: string | undefined): number => {
  if (limit === undefined || limit === '') return 100;

  const value = Number(limit);

  if (!Number.isInteger(value) || value < 1 || value > 500) {
    throw new BadRequestException('limit must be an integer between 1 and 500');
  }

  return value;
};

/** 證明聯：列印有副作用（第 2 次起為補印），所以用 POST 並要求 Idempotency-Key */
interface TurnkeyProofBody {
  readonly format?: string;
  readonly operator?: string;
}

const PROOF_FILE_EXTENSIONS: Readonly<Record<TurnkeyProofFormat, string>> = {
  [TurnkeyProofFormat.JSON]: '.json',
  [TurnkeyProofFormat.PDF]: '.pdf',
  [TurnkeyProofFormat.A4_PDF]: '.pdf',
  [TurnkeyProofFormat.PNG]: '.png',
  [TurnkeyProofFormat.ESC_POS]: '.bin',
};

/**
 * 依 routePrefix 與存取設定產生 controller；路徑前綴與 decorator 都要在 class 定義時決定，
 * 寫法同 member-base 的 createRedirectAuthController。
 */
export const createTurnkeyController = (routePrefix: string, access: TurnkeyRouteAccess): Type<unknown> => {
  if (!access.decorateRoute) {
    // 統編檢查之外沒有任何動作層級的授權：通過 canAccessCompany 的呼叫者可以開立、作廢、註銷
    new Logger('TurnkeyBaseRestModule').warn(
      'decorateRoute is not set: every caller allowed for a company can use every route. ' +
        'Use memberBaseAccess() or your own decorateRoute to check permissions per action.',
    );
  }

  const route = (action: TurnkeyApiAction): MethodDecorator =>
    applyDecorators(...(access.decorateRoute?.(action) ?? []));

  @Controller(`${routePrefix}/companies/:companyTaxId`)
  @UseGuards(createCompanyAccessGuard(access))
  @UseFilters(TurnkeyExceptionFilter)
  class TurnkeyController {
    constructor(
      readonly invoiceService: TurnkeyInvoiceService,
      readonly trackService: TurnkeyInvoiceTrackService,
      readonly submissionService: TurnkeySubmissionService,
      readonly eventService: TurnkeyEventService,
      readonly idempotencyService: TurnkeyIdempotencyService,
      readonly allowanceService: TurnkeyAllowanceService,
      readonly receivedService: TurnkeyReceivedDocumentService,
      readonly printService: TurnkeyInvoicePrintService,
    ) {}

    /** JSON 直接回傳資料；其他格式回傳檔案（每次呼叫都算一次列印） */
    private async sendProof(
      proof: TurnkeyProof,
      format: TurnkeyProofFormat,
      documentNumber: string,
      response: Response,
    ): Promise<TurnkeyProof | StreamableFile> {
      if (format === TurnkeyProofFormat.JSON) return proof;

      // 渲染失敗（例如缺選用套件）時撤銷這次的列印紀錄，下次才不會被算成補印
      const rendered = await this.printService.render(proof, { format }).catch(async (error: unknown) => {
        await this.printService.discardPrint(proof);

        throw error;
      });

      response.setHeader('Content-Type', rendered.contentType);

      return new StreamableFile(rendered.body, {
        // 號碼來自路由參數，只保留英數與 -，避免引號破壞標頭
        disposition: `inline; filename="${documentNumber.replace(/[^A-Za-z0-9-]/g, '_')}${PROOF_FILE_EXTENSIONS[format]}"`,
      });
    }

    private async replyReceived(
      action: TurnkeyReplyAction,
      companyTaxId: string,
      documentNumber: string,
      idempotencyKey: string | undefined,
      body: TurnkeyReceivedReplyBody | undefined,
      response: Response,
    ): Promise<TurnkeyReceivedDocumentEntity> {
      const key = requireIdempotencyKey(idempotencyKey);
      const options = {
        sellerTaxId: body?.sellerTaxId ?? '',
        documentDate: body?.documentDate,
        reason: body?.reason,
        remark: body?.remark,
      };

      const result = await this.idempotencyService.run(
        companyTaxId,
        key,
        `${action}:${options.sellerTaxId}:${documentNumber}`,
        options,
        async () => ({
          status: 202,
          body: await this.receivedService.reply(action, companyTaxId, documentNumber, options),
        }),
      );

      response.status(result.status);

      if (result.replayed) response.setHeader('Idempotent-Replayed', 'true');

      return result.body;
    }

    private listReceived(
      companyTaxId: string,
      messageTypes: readonly TurnkeyMigMessageType[],
      status: string | undefined,
      limit: string | undefined,
    ): Promise<TurnkeyReceivedDocumentEntity[]> {
      if (status && !Object.values(TurnkeyReceivedDocumentStatus).includes(status as TurnkeyReceivedDocumentStatus)) {
        throw new BadRequestException('Unknown status');
      }

      return this.receivedService.list(
        companyTaxId,
        messageTypes,
        status as TurnkeyReceivedDocumentStatus | undefined,
        parseLimit(limit),
      );
    }

    @Post('invoices')
    @route(TurnkeyApiAction.ISSUE_INVOICE)
    async issueInvoice(
      @Param('companyTaxId') companyTaxId: string,
      @Headers('idempotency-key') idempotencyKey: string | undefined,
      @Body() body: TurnkeyIssueInvoiceBody,
      @Res({ passthrough: true }) response: Response,
    ): Promise<BaseTurnkeyInvoiceEntity> {
      const key = requireIdempotencyKey(idempotencyKey);

      assertObject(body);

      const result = await this.idempotencyService.run(companyTaxId, key, 'issueInvoice', body, async () => ({
        status: 202,
        body: await this.invoiceService.issue({
          ...body,
          companyTaxId,
          issuedAt: parseDate(body.issuedAt, 'issuedAt'),
        }),
      }));

      response.status(result.status);

      if (result.replayed) response.setHeader('Idempotent-Replayed', 'true');

      return result.body;
    }

    @Get('invoices/:invoiceNumber')
    @route(TurnkeyApiAction.READ_INVOICE)
    async findInvoice(
      @Param('companyTaxId') companyTaxId: string,
      @Param('invoiceNumber') invoiceNumber: string,
    ): Promise<BaseTurnkeyInvoiceEntity> {
      const invoice = await this.invoiceService.findByNumber(companyTaxId, invoiceNumber);

      if (!invoice) throw new NotFoundException('Invoice not found');

      return invoice;
    }

    @Get('invoices')
    @route(TurnkeyApiAction.READ_INVOICE)
    async findInvoiceByExternalId(
      @Param('companyTaxId') companyTaxId: string,
      @Query('externalId') externalId: string | undefined,
    ): Promise<BaseTurnkeyInvoiceEntity> {
      if (!externalId) throw new BadRequestException('externalId is required');

      const invoice = await this.invoiceService.findByExternalId(companyTaxId, externalId);

      if (!invoice) throw new NotFoundException('Invoice not found');

      return invoice;
    }

    @Post('invoices/:invoiceNumber/annul')
    @route(TurnkeyApiAction.ANNUL_INVOICE)
    async annulInvoice(
      @Param('companyTaxId') companyTaxId: string,
      @Param('invoiceNumber') invoiceNumber: string,
      @Headers('idempotency-key') idempotencyKey: string | undefined,
      @Body() body: TurnkeyVoidInvoiceBody,
      @Res({ passthrough: true }) response: Response,
    ): Promise<BaseTurnkeyInvoiceEntity> {
      const key = requireIdempotencyKey(idempotencyKey);

      assertObject(body);

      const result = await this.idempotencyService.run(
        companyTaxId,
        key,
        `annulInvoice:${invoiceNumber}`,
        body,
        async () => ({
          status: 202,
          body: await this.invoiceService.annul(companyTaxId, invoiceNumber, {
            reason: body.reason,
            remark: body.remark,
          }),
        }),
      );

      response.status(result.status);

      if (result.replayed) response.setHeader('Idempotent-Replayed', 'true');

      return result.body;
    }

    @Post('invoices/:invoiceNumber/void')
    @route(TurnkeyApiAction.VOID_INVOICE)
    async voidInvoice(
      @Param('companyTaxId') companyTaxId: string,
      @Param('invoiceNumber') invoiceNumber: string,
      @Headers('idempotency-key') idempotencyKey: string | undefined,
      @Body() body: TurnkeyVoidInvoiceBody,
      @Res({ passthrough: true }) response: Response,
    ): Promise<BaseTurnkeyInvoiceEntity> {
      const key = requireIdempotencyKey(idempotencyKey);

      assertObject(body);

      const result = await this.idempotencyService.run(
        companyTaxId,
        key,
        `voidInvoice:${invoiceNumber}`,
        body,
        async () => ({
          status: 202,
          body: await this.invoiceService.void(companyTaxId, invoiceNumber, {
            reason: body.reason,
            remark: body.remark,
          }),
        }),
      );

      response.status(result.status);

      if (result.replayed) response.setHeader('Idempotent-Replayed', 'true');

      return result.body;
    }

    @Post('allowances')
    @route(TurnkeyApiAction.ISSUE_ALLOWANCE)
    async issueAllowance(
      @Param('companyTaxId') companyTaxId: string,
      @Headers('idempotency-key') idempotencyKey: string | undefined,
      @Body() body: TurnkeyIssueAllowanceBody,
      @Res({ passthrough: true }) response: Response,
    ): Promise<TurnkeyAllowanceEntity> {
      const key = requireIdempotencyKey(idempotencyKey);

      assertObject(body);

      if (!Array.isArray(body.items)) throw new BadRequestException('items must be an array');

      const result = await this.idempotencyService.run(companyTaxId, key, 'issueAllowance', body, async () => ({
        status: 202,
        body: await this.allowanceService.issue({
          ...body,
          companyTaxId,
          allowanceDate: parseDate(body.allowanceDate, 'allowanceDate'),
        }),
      }));

      response.status(result.status);

      if (result.replayed) response.setHeader('Idempotent-Replayed', 'true');

      return result.body;
    }

    @Post('allowances/:allowanceNumber/void')
    @route(TurnkeyApiAction.VOID_ALLOWANCE)
    async voidAllowance(
      @Param('companyTaxId') companyTaxId: string,
      @Param('allowanceNumber') allowanceNumber: string,
      @Headers('idempotency-key') idempotencyKey: string | undefined,
      @Body() body: { readonly reason: string },
      @Res({ passthrough: true }) response: Response,
    ): Promise<TurnkeyAllowanceEntity> {
      const key = requireIdempotencyKey(idempotencyKey);

      assertObject(body);

      const result = await this.idempotencyService.run(
        companyTaxId,
        key,
        `voidAllowance:${allowanceNumber}`,
        body,
        async () => ({
          status: 202,
          body: await this.allowanceService.void(companyTaxId, allowanceNumber, body.reason),
        }),
      );

      response.status(result.status);

      if (result.replayed) response.setHeader('Idempotent-Replayed', 'true');

      return result.body;
    }

    @Post('invoices/:invoiceNumber/proof')
    @HttpCode(200)
    @route(TurnkeyApiAction.PRINT_INVOICE)
    async invoiceProof(
      @Param('companyTaxId') companyTaxId: string,
      @Param('invoiceNumber') invoiceNumber: string,
      @Headers('idempotency-key') idempotencyKey: string | undefined,
      @Body() body: TurnkeyProofBody | undefined,
      @Res({ passthrough: true }) response: Response,
    ): Promise<TurnkeyProof | StreamableFile> {
      const key = requireIdempotencyKey(idempotencyKey);
      const proofFormat = parseProofFormat(body?.format);
      const proof = await this.printService.buildProof({
        companyTaxId,
        invoiceNumber,
        format: proofFormat,
        operator: typeof body?.operator === 'string' ? body.operator : undefined,
        idempotencyKey: key,
      });

      return this.sendProof(proof, proofFormat, invoiceNumber, response);
    }

    @Post('allowances/:allowanceNumber/proof')
    @HttpCode(200)
    @route(TurnkeyApiAction.PRINT_ALLOWANCE)
    async allowanceProof(
      @Param('companyTaxId') companyTaxId: string,
      @Param('allowanceNumber') allowanceNumber: string,
      @Headers('idempotency-key') idempotencyKey: string | undefined,
      @Body() body: TurnkeyProofBody | undefined,
      @Res({ passthrough: true }) response: Response,
    ): Promise<TurnkeyProof | StreamableFile> {
      const key = requireIdempotencyKey(idempotencyKey);
      const proofFormat = parseProofFormat(body?.format);
      const proof = await this.printService.buildAllowanceProof({
        companyTaxId,
        allowanceNumber,
        format: proofFormat,
        operator: typeof body?.operator === 'string' ? body.operator : undefined,
        idempotencyKey: key,
      });

      return this.sendProof(proof, proofFormat, allowanceNumber, response);
    }

    @Get('invoices/:invoiceNumber/allowances')
    @route(TurnkeyApiAction.READ_ALLOWANCE)
    listInvoiceAllowances(
      @Param('companyTaxId') companyTaxId: string,
      @Param('invoiceNumber') invoiceNumber: string,
    ): Promise<TurnkeyAllowanceEntity[]> {
      return this.allowanceService.listByInvoice(companyTaxId, invoiceNumber);
    }

    @Get('allowances/:allowanceNumber')
    @route(TurnkeyApiAction.READ_ALLOWANCE)
    async findAllowance(
      @Param('companyTaxId') companyTaxId: string,
      @Param('allowanceNumber') allowanceNumber: string,
    ): Promise<TurnkeyAllowanceEntity> {
      const allowance = await this.allowanceService.findByNumber(companyTaxId, allowanceNumber);

      if (!allowance) throw new NotFoundException('Allowance not found');

      return allowance;
    }

    @Post('invoices/:invoiceNumber/rejection/acknowledge')
    @route(TurnkeyApiAction.ACKNOWLEDGE_REJECTION)
    async acknowledgeRejection(
      @Param('companyTaxId') companyTaxId: string,
      @Param('invoiceNumber') invoiceNumber: string,
      @Headers('idempotency-key') idempotencyKey: string | undefined,
      @Res({ passthrough: true }) response: Response,
    ): Promise<BaseTurnkeyInvoiceEntity> {
      const key = requireIdempotencyKey(idempotencyKey);

      const result = await this.idempotencyService.run(
        companyTaxId,
        key,
        `acknowledgeRejection:${invoiceNumber}`,
        {},
        async () => ({
          status: 202,
          body: await this.invoiceService.acknowledgeRejection(companyTaxId, invoiceNumber),
        }),
      );

      response.status(result.status);

      if (result.replayed) response.setHeader('Idempotent-Replayed', 'true');

      return result.body;
    }

    @Get('received-invoices')
    @route(TurnkeyApiAction.READ_RECEIVED)
    listReceivedInvoices(
      @Param('companyTaxId') companyTaxId: string,
      @Query('status') status: string | undefined,
      @Query('limit') limit: string | undefined,
    ): Promise<TurnkeyReceivedDocumentEntity[]> {
      return this.listReceived(
        companyTaxId,
        [TurnkeyMigMessageType.A0101, TurnkeyMigMessageType.A0201, TurnkeyMigMessageType.A0302],
        status,
        limit,
      );
    }

    @Get('received-allowances')
    @route(TurnkeyApiAction.READ_RECEIVED)
    listReceivedAllowances(
      @Param('companyTaxId') companyTaxId: string,
      @Query('status') status: string | undefined,
      @Query('limit') limit: string | undefined,
    ): Promise<TurnkeyReceivedDocumentEntity[]> {
      return this.listReceived(companyTaxId, [TurnkeyMigMessageType.B0101, TurnkeyMigMessageType.B0201], status, limit);
    }

    @Post('received-invoices/:documentNumber/confirm')
    @route(TurnkeyApiAction.REPLY_RECEIVED)
    confirmInvoice(
      @Param('companyTaxId') companyTaxId: string,
      @Param('documentNumber') documentNumber: string,
      @Headers('idempotency-key') idempotencyKey: string | undefined,
      @Body() body: TurnkeyReceivedReplyBody | undefined,
      @Res({ passthrough: true }) response: Response,
    ): Promise<TurnkeyReceivedDocumentEntity> {
      return this.replyReceived('confirmInvoice', companyTaxId, documentNumber, idempotencyKey, body, response);
    }

    @Post('received-invoices/:documentNumber/reject')
    @route(TurnkeyApiAction.REPLY_RECEIVED)
    rejectInvoice(
      @Param('companyTaxId') companyTaxId: string,
      @Param('documentNumber') documentNumber: string,
      @Headers('idempotency-key') idempotencyKey: string | undefined,
      @Body() body: TurnkeyReceivedReplyBody | undefined,
      @Res({ passthrough: true }) response: Response,
    ): Promise<TurnkeyReceivedDocumentEntity> {
      return this.replyReceived('rejectInvoice', companyTaxId, documentNumber, idempotencyKey, body, response);
    }

    @Post('received-invoices/:documentNumber/void/confirm')
    @route(TurnkeyApiAction.REPLY_RECEIVED)
    confirmInvoiceVoid(
      @Param('companyTaxId') companyTaxId: string,
      @Param('documentNumber') documentNumber: string,
      @Headers('idempotency-key') idempotencyKey: string | undefined,
      @Body() body: TurnkeyReceivedReplyBody | undefined,
      @Res({ passthrough: true }) response: Response,
    ): Promise<TurnkeyReceivedDocumentEntity> {
      return this.replyReceived('confirmInvoiceVoid', companyTaxId, documentNumber, idempotencyKey, body, response);
    }

    @Post('received-allowances/:documentNumber/confirm')
    @route(TurnkeyApiAction.REPLY_RECEIVED)
    confirmAllowance(
      @Param('companyTaxId') companyTaxId: string,
      @Param('documentNumber') documentNumber: string,
      @Headers('idempotency-key') idempotencyKey: string | undefined,
      @Body() body: TurnkeyReceivedReplyBody | undefined,
      @Res({ passthrough: true }) response: Response,
    ): Promise<TurnkeyReceivedDocumentEntity> {
      return this.replyReceived('confirmAllowance', companyTaxId, documentNumber, idempotencyKey, body, response);
    }

    @Post('received-allowances/:documentNumber/void/confirm')
    @route(TurnkeyApiAction.REPLY_RECEIVED)
    confirmAllowanceVoid(
      @Param('companyTaxId') companyTaxId: string,
      @Param('documentNumber') documentNumber: string,
      @Headers('idempotency-key') idempotencyKey: string | undefined,
      @Body() body: TurnkeyReceivedReplyBody | undefined,
      @Res({ passthrough: true }) response: Response,
    ): Promise<TurnkeyReceivedDocumentEntity> {
      return this.replyReceived('confirmAllowanceVoid', companyTaxId, documentNumber, idempotencyKey, body, response);
    }

    /** 只檢查格式；有財政部 AppID 時才會查平台（尚未實作） */
    @Get('validation/mobile-barcodes/:code')
    @route(TurnkeyApiAction.VALIDATE)
    validateMobileBarcode(@Param('code') code: string): { readonly valid: boolean } {
      return { valid: isMobileBarcodeFormatValid(code) };
    }

    @Get('validation/npo-codes/:code')
    @route(TurnkeyApiAction.VALIDATE)
    validateNpoCode(@Param('code') code: string): { readonly valid: boolean } {
      return { valid: isNpoCodeFormatValid(code) };
    }

    @Post('invoice-tracks')
    @HttpCode(201)
    @route(TurnkeyApiAction.REGISTER_INVOICE_TRACK)
    async registerTrack(
      @Param('companyTaxId') companyTaxId: string,
      @Headers('idempotency-key') idempotencyKey: string | undefined,
      @Body() body: TurnkeyRegisterTrackBody,
      @Res({ passthrough: true }) response: Response,
    ): Promise<TurnkeyInvoiceTrackEntity> {
      const key = requireIdempotencyKey(idempotencyKey);

      assertObject(body);

      const result = await this.idempotencyService.run(companyTaxId, key, 'registerTrack', body, async () => ({
        status: 201,
        body: await this.trackService.register({ ...body, companyTaxId }),
      }));

      if (result.replayed) response.setHeader('Idempotent-Replayed', 'true');

      return result.body;
    }

    @Post('invoice-tracks/:period/blank-number-reports')
    @route(TurnkeyApiAction.REPORT_BLANK_NUMBERS)
    async reportBlankNumbers(
      @Param('companyTaxId') companyTaxId: string,
      @Param('period') period: string,
      @Headers('idempotency-key') idempotencyKey: string | undefined,
      @Res({ passthrough: true }) response: Response,
    ): Promise<readonly TurnkeyBlankNumberReport[]> {
      const key = requireIdempotencyKey(idempotencyKey);

      const result = await this.idempotencyService.run(
        companyTaxId,
        key,
        `reportBlankNumbers:${period}`,
        {},
        async () => ({ status: 202, body: await this.trackService.reportBlankNumbers(companyTaxId, period) }),
      );

      response.status(result.status);

      if (result.replayed) response.setHeader('Idempotent-Replayed', 'true');

      return result.body;
    }

    @Post('invoice-numbers/:invoiceNumber/abandon')
    @HttpCode(200)
    @route(TurnkeyApiAction.ABANDON_INVOICE_NUMBER)
    async abandonInvoiceNumber(
      @Param('companyTaxId') companyTaxId: string,
      @Param('invoiceNumber') invoiceNumber: string,
      @Headers('idempotency-key') idempotencyKey: string | undefined,
      @Res({ passthrough: true }) response: Response,
    ): Promise<TurnkeyInvoiceNumberEntity> {
      const key = requireIdempotencyKey(idempotencyKey);

      const result = await this.idempotencyService.run(
        companyTaxId,
        key,
        `abandonInvoiceNumber:${invoiceNumber}`,
        {},
        async () => ({ status: 200, body: await this.trackService.abandon(companyTaxId, invoiceNumber) }),
      );

      if (result.replayed) response.setHeader('Idempotent-Replayed', 'true');

      return result.body;
    }

    @Post('submissions/:submissionId/retry')
    @route(TurnkeyApiAction.RETRY_SUBMISSION)
    async retrySubmission(
      @Param('companyTaxId') companyTaxId: string,
      @Param('submissionId') submissionId: string,
      @Headers('idempotency-key') idempotencyKey: string | undefined,
      @Res({ passthrough: true }) response: Response,
    ): Promise<TurnkeySubmissionEntity> {
      const key = requireIdempotencyKey(idempotencyKey);

      if (!/^[0-9a-f-]{36}$/i.test(submissionId)) throw new NotFoundException('Submission not found');

      const result = await this.idempotencyService.run(
        companyTaxId,
        key,
        `retrySubmission:${submissionId}`,
        {},
        async () => ({ status: 202, body: await this.submissionService.retry(companyTaxId, submissionId) }),
      );

      response.status(result.status);

      if (result.replayed) response.setHeader('Idempotent-Replayed', 'true');

      return result.body;
    }

    @Get('submissions/:submissionId')
    @route(TurnkeyApiAction.READ_SUBMISSION)
    async findSubmission(
      @Param('companyTaxId') companyTaxId: string,
      @Param('submissionId') submissionId: string,
    ): Promise<TurnkeySubmissionEntity> {
      if (!/^[0-9a-f-]{36}$/i.test(submissionId)) throw new NotFoundException('Submission not found');

      const submission = await this.submissionService.findById(companyTaxId, submissionId);

      if (!submission) throw new NotFoundException('Submission not found');

      return submission;
    }

    @Get('submissions')
    @route(TurnkeyApiAction.READ_SUBMISSION)
    listSubmissions(
      @Param('companyTaxId') companyTaxId: string,
      @Query('status') status: string | undefined,
      @Query('limit') limit: string | undefined,
    ): Promise<TurnkeySubmissionEntity[]> {
      const take = parseLimit(limit);

      if (!status || status === 'PENDING') return this.submissionService.listPending(companyTaxId, take);

      if (!Object.values(TurnkeySubmissionStatus).includes(status as TurnkeySubmissionStatus)) {
        throw new BadRequestException('Unknown submission status');
      }

      return this.submissionService.listByStatus(companyTaxId, status as TurnkeySubmissionStatus, take);
    }

    @Get('events')
    @route(TurnkeyApiAction.READ_EVENTS)
    listEvents(
      @Param('companyTaxId') companyTaxId: string,
      @Query('after') after: string | undefined,
      @Query('limit') limit: string | undefined,
    ): Promise<{ readonly events: readonly TurnkeyEvent[]; readonly nextCursor: string | null }> {
      if (after !== undefined && !/^\d+$/.test(after)) throw new BadRequestException('after must be a cursor');

      return this.eventService.listAfter(after ?? null, parseLimit(limit), companyTaxId);
    }
  }

  return TurnkeyController;
};
