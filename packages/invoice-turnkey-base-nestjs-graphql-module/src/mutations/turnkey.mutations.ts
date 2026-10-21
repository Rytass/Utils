import { applyDecorators, Type } from '@nestjs/common';
import { Args, Context, Mutation, Resolver } from '@nestjs/graphql';
import {
  TurnkeyAllowanceProof,
  TurnkeyAllowanceService,
  TurnkeyIdempotencyService,
  TurnkeyInvoicePrintService,
  TurnkeyInvoiceProof,
  TurnkeyProofFormat,
  TurnkeyInvoiceService,
  TurnkeyInvoiceTrackService,
  TurnkeyReceivedDocumentService,
  TurnkeySubmissionService,
  TurnkeyValidationCode,
  TurnkeyValidationError,
} from '@rytass/invoice-turnkey-base-nestjs-module';
import type { TurnkeyReplyAction } from '@rytass/invoice-turnkey-base-nestjs-module';
import { TurnkeyAllowanceDto } from '../dto/turnkey-allowance.dto';
import { TurnkeyBlankNumberReportDto } from '../dto/turnkey-blank-number.dto';
import { TurnkeyInvoiceDto } from '../dto/turnkey-invoice.dto';
import {
  AnnulTurnkeyInvoiceInput,
  IssueTurnkeyAllowanceInput,
  IssueTurnkeyInvoiceInput,
  RegisterTurnkeyInvoiceTrackInput,
  RejectTurnkeyReceivedInvoiceInput,
  TurnkeyReceivedReplyInput,
  VoidTurnkeyInvoiceInput,
} from '../dto/turnkey-invoice.input';
import { TurnkeyInvoiceNumberDto } from '../dto/turnkey-invoice-number.dto';
import { TurnkeyInvoiceTrackDto } from '../dto/turnkey-track.dto';
import { TurnkeyReceivedDocumentDto } from '../dto/turnkey-received-document.dto';
import { TurnkeySubmissionDto } from '../dto/turnkey-submission.dto';
import {
  toAllowanceDto,
  toAllowanceIssueInput,
  toBlankNumberReportDto,
  toInvoiceDto,
  toInvoiceIssueInput,
  toInvoiceNumberDto,
  toReceivedDocumentDto,
  toSubmissionDto,
  toTrackDto,
} from '../turnkey-graphql.mappers';
import { assertCompanyAccess, requireIdempotencyKey, runTurnkey } from '../turnkey-graphql.helpers';
import { TurnkeyApiAction } from '../turnkey-graphql.options';
import type { TurnkeyGraphQLContext, TurnkeyRouteAccess } from '../turnkey-graphql.options';

const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

/**
 * 依 access 產生 Mutation resolver。每個 mutation 都需要 idempotencyKey，
 * 走 TurnkeyIdempotencyService.run（與 REST 共用同一張 key 表與同樣的 action 名稱）。
 */
export const createTurnkeyMutationResolver = (access: TurnkeyRouteAccess): Type<unknown> => {
  const route = (action: TurnkeyApiAction): MethodDecorator =>
    applyDecorators(...(access.decorateRoute?.(action) ?? []));

  @Resolver()
  class TurnkeyMutationResolver {
    constructor(
      private readonly invoiceService: TurnkeyInvoiceService,
      private readonly allowanceService: TurnkeyAllowanceService,
      private readonly trackService: TurnkeyInvoiceTrackService,
      private readonly submissionService: TurnkeySubmissionService,
      private readonly receivedService: TurnkeyReceivedDocumentService,
      private readonly idempotencyService: TurnkeyIdempotencyService,
      private readonly printService: TurnkeyInvoicePrintService,
    ) {}

    /**
     * 發票證明聯（JSON）。每次列印寫一筆 print log，第 2 次起 reprint 為 true；
     * 同一個 idempotencyKey 重送回傳同一次列印，網路重試不會把第一張變成補印。
     */
    @Mutation(() => Object, { name: 'printTurnkeyInvoiceProof' })
    @route(TurnkeyApiAction.PRINT_INVOICE)
    async printTurnkeyInvoiceProof(
      @Context() context: TurnkeyGraphQLContext,
      @Args('companyTaxId') companyTaxId: string,
      @Args('invoiceNumber') invoiceNumber: string,
      @Args('idempotencyKey') idempotencyKey: string,
    ): Promise<TurnkeyInvoiceProof> {
      await assertCompanyAccess(access, context.req, companyTaxId);

      const key = requireIdempotencyKey(idempotencyKey);

      return runTurnkey(() =>
        this.printService.buildProof({
          companyTaxId,
          invoiceNumber,
          format: TurnkeyProofFormat.JSON,
          idempotencyKey: key,
        }),
      );
    }

    /** 折讓證明單（JSON）；冪等規則同 printTurnkeyInvoiceProof */
    @Mutation(() => Object, { name: 'printTurnkeyAllowanceProof' })
    @route(TurnkeyApiAction.PRINT_ALLOWANCE)
    async printTurnkeyAllowanceProof(
      @Context() context: TurnkeyGraphQLContext,
      @Args('companyTaxId') companyTaxId: string,
      @Args('allowanceNumber') allowanceNumber: string,
      @Args('idempotencyKey') idempotencyKey: string,
    ): Promise<TurnkeyAllowanceProof> {
      await assertCompanyAccess(access, context.req, companyTaxId);

      const key = requireIdempotencyKey(idempotencyKey);

      return runTurnkey(() =>
        this.printService.buildAllowanceProof({
          companyTaxId,
          allowanceNumber,
          format: TurnkeyProofFormat.JSON,
          idempotencyKey: key,
        }),
      );
    }

    @Mutation(() => TurnkeyInvoiceDto, { name: 'issueTurnkeyInvoice' })
    @route(TurnkeyApiAction.ISSUE_INVOICE)
    async issueTurnkeyInvoice(
      @Context() context: TurnkeyGraphQLContext,
      @Args('companyTaxId') companyTaxId: string,
      @Args('idempotencyKey') idempotencyKey: string,
      @Args('input') input: IssueTurnkeyInvoiceInput,
    ): Promise<TurnkeyInvoiceDto> {
      await assertCompanyAccess(access, context.req, companyTaxId);

      const key = requireIdempotencyKey(idempotencyKey);

      return runTurnkey(async () => {
        const result = await this.idempotencyService.run(companyTaxId, key, 'issueInvoice', input, async () => ({
          status: 202,
          body: toInvoiceDto(await this.invoiceService.issue(toInvoiceIssueInput(input, companyTaxId))),
        }));

        return result.body;
      });
    }

    @Mutation(() => TurnkeyInvoiceDto, { name: 'voidTurnkeyInvoice' })
    @route(TurnkeyApiAction.VOID_INVOICE)
    async voidTurnkeyInvoice(
      @Context() context: TurnkeyGraphQLContext,
      @Args('companyTaxId') companyTaxId: string,
      @Args('invoiceNumber') invoiceNumber: string,
      @Args('idempotencyKey') idempotencyKey: string,
      @Args('input') input: VoidTurnkeyInvoiceInput,
    ): Promise<TurnkeyInvoiceDto> {
      await assertCompanyAccess(access, context.req, companyTaxId);

      const key = requireIdempotencyKey(idempotencyKey);

      return runTurnkey(async () => {
        const result = await this.idempotencyService.run(
          companyTaxId,
          key,
          `voidInvoice:${invoiceNumber}`,
          input,
          async () => ({
            status: 202,
            body: toInvoiceDto(
              await this.invoiceService.void(companyTaxId, invoiceNumber, {
                reason: input.reason,
                remark: input.remark ?? undefined,
              }),
            ),
          }),
        );

        return result.body;
      });
    }

    /** 註銷發票；與作廢（void）是不同的授權 action（ANNUL_INVOICE） */
    @Mutation(() => TurnkeyInvoiceDto, { name: 'annulTurnkeyInvoice' })
    @route(TurnkeyApiAction.ANNUL_INVOICE)
    async annulTurnkeyInvoice(
      @Context() context: TurnkeyGraphQLContext,
      @Args('companyTaxId') companyTaxId: string,
      @Args('invoiceNumber') invoiceNumber: string,
      @Args('idempotencyKey') idempotencyKey: string,
      @Args('input') input: AnnulTurnkeyInvoiceInput,
    ): Promise<TurnkeyInvoiceDto> {
      await assertCompanyAccess(access, context.req, companyTaxId);

      const key = requireIdempotencyKey(idempotencyKey);

      return runTurnkey(async () => {
        const result = await this.idempotencyService.run(
          companyTaxId,
          key,
          `annulInvoice:${invoiceNumber}`,
          input,
          async () => ({
            status: 202,
            body: toInvoiceDto(
              await this.invoiceService.annul(companyTaxId, invoiceNumber, {
                reason: input.reason,
                remark: input.remark ?? undefined,
              }),
            ),
          }),
        );

        return result.body;
      });
    }

    /** 確認平台退回（A0302）後的發票狀態 */
    @Mutation(() => TurnkeyInvoiceDto, { name: 'acknowledgeTurnkeyInvoiceRejection' })
    @route(TurnkeyApiAction.ACKNOWLEDGE_REJECTION)
    async acknowledgeTurnkeyInvoiceRejection(
      @Context() context: TurnkeyGraphQLContext,
      @Args('companyTaxId') companyTaxId: string,
      @Args('invoiceNumber') invoiceNumber: string,
      @Args('idempotencyKey') idempotencyKey: string,
    ): Promise<TurnkeyInvoiceDto> {
      await assertCompanyAccess(access, context.req, companyTaxId);

      const key = requireIdempotencyKey(idempotencyKey);

      return runTurnkey(async () => {
        const result = await this.idempotencyService.run(
          companyTaxId,
          key,
          `acknowledgeRejection:${invoiceNumber}`,
          {},
          async () => ({
            status: 202,
            body: toInvoiceDto(await this.invoiceService.acknowledgeRejection(companyTaxId, invoiceNumber)),
          }),
        );

        return result.body;
      });
    }

    @Mutation(() => TurnkeyAllowanceDto, { name: 'issueTurnkeyAllowance' })
    @route(TurnkeyApiAction.ISSUE_ALLOWANCE)
    async issueTurnkeyAllowance(
      @Context() context: TurnkeyGraphQLContext,
      @Args('companyTaxId') companyTaxId: string,
      @Args('idempotencyKey') idempotencyKey: string,
      @Args('input') input: IssueTurnkeyAllowanceInput,
    ): Promise<TurnkeyAllowanceDto> {
      await assertCompanyAccess(access, context.req, companyTaxId);

      const key = requireIdempotencyKey(idempotencyKey);

      return runTurnkey(async () => {
        const result = await this.idempotencyService.run(companyTaxId, key, 'issueAllowance', input, async () => ({
          status: 202,
          body: toAllowanceDto(await this.allowanceService.issue(toAllowanceIssueInput(input, companyTaxId))),
        }));

        return result.body;
      });
    }

    @Mutation(() => TurnkeyAllowanceDto, { name: 'voidTurnkeyAllowance' })
    @route(TurnkeyApiAction.VOID_ALLOWANCE)
    async voidTurnkeyAllowance(
      @Context() context: TurnkeyGraphQLContext,
      @Args('companyTaxId') companyTaxId: string,
      @Args('allowanceNumber') allowanceNumber: string,
      @Args('idempotencyKey') idempotencyKey: string,
      @Args('reason') reason: string,
    ): Promise<TurnkeyAllowanceDto> {
      await assertCompanyAccess(access, context.req, companyTaxId);

      const key = requireIdempotencyKey(idempotencyKey);

      return runTurnkey(async () => {
        const result = await this.idempotencyService.run(
          companyTaxId,
          key,
          `voidAllowance:${allowanceNumber}`,
          { reason },
          async () => ({
            status: 202,
            body: toAllowanceDto(await this.allowanceService.void(companyTaxId, allowanceNumber, reason)),
          }),
        );

        return result.body;
      });
    }

    @Mutation(() => TurnkeyInvoiceTrackDto, { name: 'registerTurnkeyInvoiceTrack' })
    @route(TurnkeyApiAction.REGISTER_INVOICE_TRACK)
    async registerTurnkeyInvoiceTrack(
      @Context() context: TurnkeyGraphQLContext,
      @Args('companyTaxId') companyTaxId: string,
      @Args('idempotencyKey') idempotencyKey: string,
      @Args('input') input: RegisterTurnkeyInvoiceTrackInput,
    ): Promise<TurnkeyInvoiceTrackDto> {
      await assertCompanyAccess(access, context.req, companyTaxId);

      const key = requireIdempotencyKey(idempotencyKey);

      return runTurnkey(async () => {
        const result = await this.idempotencyService.run(companyTaxId, key, 'registerTrack', input, async () => {
          const track = await this.trackService.register({
            companyTaxId,
            period: input.period,
            track: input.track,
            beginNumber: input.beginNumber,
            endNumber: input.endNumber,
          });

          const remaining = await this.trackService.remaining(companyTaxId, track.period);

          return { status: 201, body: toTrackDto(track, remaining) };
        });

        return result.body;
      });
    }

    /** 空白號碼申報（期別結束後才能申報）；每個字軌一筆結果 */
    @Mutation(() => [TurnkeyBlankNumberReportDto], { name: 'reportTurnkeyBlankNumbers' })
    @route(TurnkeyApiAction.REPORT_BLANK_NUMBERS)
    async reportTurnkeyBlankNumbers(
      @Context() context: TurnkeyGraphQLContext,
      @Args('companyTaxId') companyTaxId: string,
      @Args('period') period: string,
      @Args('idempotencyKey') idempotencyKey: string,
    ): Promise<TurnkeyBlankNumberReportDto[]> {
      await assertCompanyAccess(access, context.req, companyTaxId);

      const key = requireIdempotencyKey(idempotencyKey);

      return runTurnkey(async () => {
        const result = await this.idempotencyService.run(
          companyTaxId,
          key,
          `reportBlankNumbers:${period}`,
          {},
          async () => ({
            status: 202,
            body: (await this.trackService.reportBlankNumbers(companyTaxId, period)).map(toBlankNumberReportDto),
          }),
        );

        return result.body;
      });
    }

    /** 放棄退回的號碼（RETURNED → ABANDONED） */
    @Mutation(() => TurnkeyInvoiceNumberDto, { name: 'abandonTurnkeyInvoiceNumber' })
    @route(TurnkeyApiAction.ABANDON_INVOICE_NUMBER)
    async abandonTurnkeyInvoiceNumber(
      @Context() context: TurnkeyGraphQLContext,
      @Args('companyTaxId') companyTaxId: string,
      @Args('invoiceNumber') invoiceNumber: string,
      @Args('idempotencyKey') idempotencyKey: string,
    ): Promise<TurnkeyInvoiceNumberDto> {
      await assertCompanyAccess(access, context.req, companyTaxId);

      const key = requireIdempotencyKey(idempotencyKey);

      return runTurnkey(async () => {
        const result = await this.idempotencyService.run(
          companyTaxId,
          key,
          `abandonInvoiceNumber:${invoiceNumber}`,
          {},
          async () => ({
            status: 202,
            body: toInvoiceNumberDto(await this.trackService.abandon(companyTaxId, invoiceNumber)),
          }),
        );

        return result.body;
      });
    }

    /** 重送送件；submissionId 格式不對直接視為找不到（同 REST，避免 uuid 欄位查詢出錯） */
    @Mutation(() => TurnkeySubmissionDto, { name: 'retryTurnkeySubmission' })
    @route(TurnkeyApiAction.RETRY_SUBMISSION)
    async retryTurnkeySubmission(
      @Context() context: TurnkeyGraphQLContext,
      @Args('companyTaxId') companyTaxId: string,
      @Args('submissionId') submissionId: string,
      @Args('idempotencyKey') idempotencyKey: string,
    ): Promise<TurnkeySubmissionDto> {
      await assertCompanyAccess(access, context.req, companyTaxId);

      const key = requireIdempotencyKey(idempotencyKey);

      return runTurnkey(async () => {
        if (!UUID_PATTERN.test(submissionId)) {
          throw new TurnkeyValidationError([
            {
              code: TurnkeyValidationCode.SUBMISSION_NOT_FOUND,
              message: '找不到送件紀錄',
              field: 'submissionId',
            },
          ]);
        }

        const result = await this.idempotencyService.run(
          companyTaxId,
          key,
          `retrySubmission:${submissionId}`,
          {},
          async () => ({
            status: 202,
            body: toSubmissionDto(await this.submissionService.retry(companyTaxId, submissionId)),
          }),
        );

        return result.body;
      });
    }

    /** 收件（我方為買方）：確認發票 */
    @Mutation(() => TurnkeyReceivedDocumentDto, { name: 'confirmTurnkeyReceivedInvoice' })
    @route(TurnkeyApiAction.REPLY_RECEIVED)
    confirmTurnkeyReceivedInvoice(
      @Context() context: TurnkeyGraphQLContext,
      @Args('companyTaxId') companyTaxId: string,
      @Args('documentNumber') documentNumber: string,
      @Args('sellerTaxId', { description: '開立這份文件的賣方統編' }) sellerTaxId: string,
      @Args('documentDate', {
        type: () => String,
        nullable: true,
        description: 'yyyyMMdd；同一賣方同一號碼有多份時必填',
      })
      documentDate: string | null | undefined,
      @Args('idempotencyKey') idempotencyKey: string,
      @Args('input', { type: () => TurnkeyReceivedReplyInput, nullable: true })
      input?: TurnkeyReceivedReplyInput | null,
    ): Promise<TurnkeyReceivedDocumentDto> {
      return this.replyReceived(
        context,
        companyTaxId,
        { sellerTaxId, documentNumber, documentDate },
        idempotencyKey,
        'confirmInvoice',
        input,
      );
    }

    /** 收件（我方為買方）：退回發票，reason 必填 */
    @Mutation(() => TurnkeyReceivedDocumentDto, { name: 'rejectTurnkeyReceivedInvoice' })
    @route(TurnkeyApiAction.REPLY_RECEIVED)
    rejectTurnkeyReceivedInvoice(
      @Context() context: TurnkeyGraphQLContext,
      @Args('companyTaxId') companyTaxId: string,
      @Args('documentNumber') documentNumber: string,
      @Args('sellerTaxId', { description: '開立這份文件的賣方統編' }) sellerTaxId: string,
      @Args('documentDate', {
        type: () => String,
        nullable: true,
        description: 'yyyyMMdd；同一賣方同一號碼有多份時必填',
      })
      documentDate: string | null | undefined,
      @Args('idempotencyKey') idempotencyKey: string,
      @Args('input') input: RejectTurnkeyReceivedInvoiceInput,
    ): Promise<TurnkeyReceivedDocumentDto> {
      return this.replyReceived(
        context,
        companyTaxId,
        { sellerTaxId, documentNumber, documentDate },
        idempotencyKey,
        'rejectInvoice',
        input,
      );
    }

    /** 收件（我方為買方）：確認發票作廢 */
    @Mutation(() => TurnkeyReceivedDocumentDto, { name: 'confirmTurnkeyReceivedInvoiceVoid' })
    @route(TurnkeyApiAction.REPLY_RECEIVED)
    confirmTurnkeyReceivedInvoiceVoid(
      @Context() context: TurnkeyGraphQLContext,
      @Args('companyTaxId') companyTaxId: string,
      @Args('documentNumber') documentNumber: string,
      @Args('sellerTaxId', { description: '開立這份文件的賣方統編' }) sellerTaxId: string,
      @Args('documentDate', {
        type: () => String,
        nullable: true,
        description: 'yyyyMMdd；同一賣方同一號碼有多份時必填',
      })
      documentDate: string | null | undefined,
      @Args('idempotencyKey') idempotencyKey: string,
      @Args('input', { type: () => TurnkeyReceivedReplyInput, nullable: true })
      input?: TurnkeyReceivedReplyInput | null,
    ): Promise<TurnkeyReceivedDocumentDto> {
      return this.replyReceived(
        context,
        companyTaxId,
        { sellerTaxId, documentNumber, documentDate },
        idempotencyKey,
        'confirmInvoiceVoid',
        input,
      );
    }

    /** 收件（我方為買方）：確認折讓 */
    @Mutation(() => TurnkeyReceivedDocumentDto, { name: 'confirmTurnkeyReceivedAllowance' })
    @route(TurnkeyApiAction.REPLY_RECEIVED)
    confirmTurnkeyReceivedAllowance(
      @Context() context: TurnkeyGraphQLContext,
      @Args('companyTaxId') companyTaxId: string,
      @Args('documentNumber') documentNumber: string,
      @Args('sellerTaxId', { description: '開立這份文件的賣方統編' }) sellerTaxId: string,
      @Args('documentDate', {
        type: () => String,
        nullable: true,
        description: 'yyyyMMdd；同一賣方同一號碼有多份時必填',
      })
      documentDate: string | null | undefined,
      @Args('idempotencyKey') idempotencyKey: string,
      @Args('input', { type: () => TurnkeyReceivedReplyInput, nullable: true })
      input?: TurnkeyReceivedReplyInput | null,
    ): Promise<TurnkeyReceivedDocumentDto> {
      return this.replyReceived(
        context,
        companyTaxId,
        { sellerTaxId, documentNumber, documentDate },
        idempotencyKey,
        'confirmAllowance',
        input,
      );
    }

    /** 收件（我方為買方）：確認折讓作廢 */
    @Mutation(() => TurnkeyReceivedDocumentDto, { name: 'confirmTurnkeyReceivedAllowanceVoid' })
    @route(TurnkeyApiAction.REPLY_RECEIVED)
    confirmTurnkeyReceivedAllowanceVoid(
      @Context() context: TurnkeyGraphQLContext,
      @Args('companyTaxId') companyTaxId: string,
      @Args('documentNumber') documentNumber: string,
      @Args('sellerTaxId', { description: '開立這份文件的賣方統編' }) sellerTaxId: string,
      @Args('documentDate', {
        type: () => String,
        nullable: true,
        description: 'yyyyMMdd；同一賣方同一號碼有多份時必填',
      })
      documentDate: string | null | undefined,
      @Args('idempotencyKey') idempotencyKey: string,
      @Args('input', { type: () => TurnkeyReceivedReplyInput, nullable: true })
      input?: TurnkeyReceivedReplyInput | null,
    ): Promise<TurnkeyReceivedDocumentDto> {
      return this.replyReceived(
        context,
        companyTaxId,
        { sellerTaxId, documentNumber, documentDate },
        idempotencyKey,
        'confirmAllowanceVoid',
        input,
      );
    }

    /** 五個收件回覆 mutation 共用的流程：權限 → 冪等 key → 冪等執行 → 回傳 */
    private async replyReceived(
      context: TurnkeyGraphQLContext,
      companyTaxId: string,
      target: {
        readonly sellerTaxId: string;
        readonly documentNumber: string;
        readonly documentDate: string | null | undefined;
      },
      idempotencyKey: string,
      action: TurnkeyReplyAction,
      input: TurnkeyReceivedReplyInput | null | undefined,
    ): Promise<TurnkeyReceivedDocumentDto> {
      await assertCompanyAccess(access, context.req, companyTaxId);

      const key = requireIdempotencyKey(idempotencyKey);
      const { sellerTaxId, documentNumber } = target;
      const options = {
        sellerTaxId,
        documentDate: target.documentDate ?? undefined,
        reason: input?.reason ?? undefined,
        remark: input?.remark ?? undefined,
      };

      return runTurnkey(async () => {
        const result = await this.idempotencyService.run(
          companyTaxId,
          key,
          `${action}:${sellerTaxId}:${documentNumber}`,
          options,
          async () => ({
            status: 202,
            body: toReceivedDocumentDto(
              await this.receivedService.reply(action, companyTaxId, documentNumber, options),
            ),
          }),
        );

        return result.body;
      });
    }
  }

  return TurnkeyMutationResolver;
};
