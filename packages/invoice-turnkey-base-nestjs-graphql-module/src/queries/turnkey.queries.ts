import { applyDecorators, Type } from '@nestjs/common';
import { Args, Context, Int, Query, Resolver } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import {
  TurnkeyCompanyService,
  TurnkeyAllowanceService,
  TurnkeyEventService,
  TurnkeyInvoiceService,
  TurnkeyMigMessageType,
  TurnkeyReceivedDocumentService,
  TurnkeyReceivedDocumentStatus,
  TurnkeySubmissionService,
  TurnkeySubmissionStatus,
} from '@rytass/invoice-turnkey-base-nestjs-module';
import type { TurnkeySubmissionEntity } from '@rytass/invoice-turnkey-base-nestjs-module';
import { TurnkeyAllowanceDto } from '../dto/turnkey-allowance.dto';
import { TurnkeyCompanyDto } from '../dto/turnkey-company.dto';
import { TurnkeyEventCollectionDto } from '../dto/turnkey-event.dto';
import { TurnkeyInvoiceDto } from '../dto/turnkey-invoice.dto';
import { TurnkeySubmissionCollectionDto } from '../dto/turnkey-submission.dto';
import { TurnkeyReceivedDocumentDto } from '../dto/turnkey-received-document.dto';
import {
  toAllowanceDto,
  toEventDto,
  toInvoiceDto,
  toReceivedDocumentDto,
  toSubmissionDto,
} from '../turnkey-graphql.mappers';
import { assertCompanyAccess } from '../turnkey-graphql.helpers';
import { TurnkeyApiAction } from '../turnkey-graphql.options';
import type { TurnkeyGraphQLContext, TurnkeyRouteAccess } from '../turnkey-graphql.options';

const DEFAULT_LIMIT = 100;

/** 我方為買方時收到的發票類文件（A0101、A0201、A0302） */
const RECEIVED_INVOICE_TYPES = [TurnkeyMigMessageType.A0101, TurnkeyMigMessageType.A0201, TurnkeyMigMessageType.A0302];

/** 我方為買方時收到的折讓類文件（B0101、B0201） */
const RECEIVED_ALLOWANCE_TYPES = [TurnkeyMigMessageType.B0101, TurnkeyMigMessageType.B0201];

/** 依 access 產生 Query resolver（decorator 要在 class 建立時套上，寫法同 REST controller） */
export const createTurnkeyQueryResolver = (access: TurnkeyRouteAccess): Type<unknown> => {
  const route = (action: TurnkeyApiAction): MethodDecorator =>
    applyDecorators(...(access.decorateRoute?.(action) ?? []));

  @Resolver()
  class TurnkeyQueryResolver {
    constructor(
      private readonly invoiceService: TurnkeyInvoiceService,
      private readonly allowanceService: TurnkeyAllowanceService,
      private readonly submissionService: TurnkeySubmissionService,
      private readonly eventService: TurnkeyEventService,
      private readonly receivedService: TurnkeyReceivedDocumentService,
      private readonly companyService: TurnkeyCompanyService,
    ) {}

    /** 營業人資料；未登錄回傳 null。QR Code 金鑰不回傳，只標示 qrAesKeyConfigured */
    @Query(() => TurnkeyCompanyDto, { nullable: true, name: 'turnkeyCompany' })
    @route(TurnkeyApiAction.READ_COMPANY)
    async turnkeyCompany(
      @Context() context: TurnkeyGraphQLContext,
      @Args('companyTaxId') companyTaxId: string,
    ): Promise<TurnkeyCompanyDto | null> {
      await assertCompanyAccess(access, context.req, companyTaxId);

      return this.companyService.describe(companyTaxId);
    }

    @Query(() => TurnkeyInvoiceDto, { nullable: true, name: 'turnkeyInvoice' })
    @route(TurnkeyApiAction.READ_INVOICE)
    async turnkeyInvoice(
      @Context() context: TurnkeyGraphQLContext,
      @Args('companyTaxId') companyTaxId: string,
      @Args('invoiceNumber') invoiceNumber: string,
    ): Promise<TurnkeyInvoiceDto | null> {
      await assertCompanyAccess(access, context.req, companyTaxId);

      const invoice = await this.invoiceService.findByNumber(companyTaxId, invoiceNumber);

      return invoice ? toInvoiceDto(invoice) : null;
    }

    @Query(() => TurnkeyAllowanceDto, { nullable: true, name: 'turnkeyAllowance' })
    @route(TurnkeyApiAction.READ_ALLOWANCE)
    async turnkeyAllowance(
      @Context() context: TurnkeyGraphQLContext,
      @Args('companyTaxId') companyTaxId: string,
      @Args('allowanceNumber') allowanceNumber: string,
    ): Promise<TurnkeyAllowanceDto | null> {
      await assertCompanyAccess(access, context.req, companyTaxId);

      const allowance = await this.allowanceService.findByNumber(companyTaxId, allowanceNumber);

      return allowance ? toAllowanceDto(allowance) : null;
    }

    /** 不帶 status／documentNumber 時回傳尚無平台結果的送件（同 REST 的預設） */
    @Query(() => TurnkeySubmissionCollectionDto, { name: 'turnkeySubmissions' })
    @route(TurnkeyApiAction.READ_SUBMISSION)
    async turnkeySubmissions(
      @Context() context: TurnkeyGraphQLContext,
      @Args('companyTaxId') companyTaxId: string,
      @Args('status', { type: () => TurnkeySubmissionStatus, nullable: true })
      status?: TurnkeySubmissionStatus | null,
      @Args('limit', { type: () => Int, nullable: true }) limit?: number | null,
      @Args('documentNumber', { type: () => String, nullable: true }) documentNumber?: string | null,
    ): Promise<TurnkeySubmissionCollectionDto> {
      await assertCompanyAccess(access, context.req, companyTaxId);

      if (documentNumber && !/^[A-Za-z0-9-]{1,16}$/.test(documentNumber)) {
        throw new GraphQLError('Invalid documentNumber', {
          extensions: { code: 'BAD_USER_INPUT', field: 'documentNumber' },
        });
      }

      const take = limit ?? DEFAULT_LIMIT;
      const listDefault = (): Promise<TurnkeySubmissionEntity[]> =>
        !status || status === TurnkeySubmissionStatus.PENDING
          ? this.submissionService.listPending(companyTaxId, take)
          : this.submissionService.listByStatus(companyTaxId, status, take);

      // 指定單號時回傳該單號全部送件（新到舊），status 只作為額外篩選。
      const rows = documentNumber
        ? await this.submissionService.listByDocument(companyTaxId, documentNumber, status ?? undefined, take)
        : await listDefault();

      return { items: rows.map(toSubmissionDto) };
    }

    @Query(() => TurnkeyEventCollectionDto, { name: 'turnkeyEvents' })
    @route(TurnkeyApiAction.READ_EVENTS)
    async turnkeyEvents(
      @Context() context: TurnkeyGraphQLContext,
      @Args('companyTaxId') companyTaxId: string,
      @Args('after', { type: () => String, nullable: true }) after?: string | null,
      @Args('limit', { type: () => Int, nullable: true }) limit?: number | null,
    ): Promise<TurnkeyEventCollectionDto> {
      await assertCompanyAccess(access, context.req, companyTaxId);

      if (after !== undefined && after !== null && !/^\d+$/.test(after)) {
        throw new GraphQLError('after must be a cursor', { extensions: { code: 'BAD_USER_INPUT', field: 'after' } });
      }

      const page = await this.eventService.listAfter(after ?? null, limit ?? DEFAULT_LIMIT, companyTaxId);

      return {
        events: page.events.map(toEventDto),
        nextCursor: page.nextCursor,
      };
    }

    /** 某張發票底下的折讓（獨立 query，不做成 TurnkeyInvoice 欄位，因此沒有 N+1 問題） */
    @Query(() => [TurnkeyAllowanceDto], { name: 'turnkeyAllowancesByInvoice' })
    @route(TurnkeyApiAction.READ_ALLOWANCE)
    async turnkeyAllowancesByInvoice(
      @Context() context: TurnkeyGraphQLContext,
      @Args('companyTaxId') companyTaxId: string,
      @Args('invoiceNumber') invoiceNumber: string,
    ): Promise<TurnkeyAllowanceDto[]> {
      await assertCompanyAccess(access, context.req, companyTaxId);

      const rows = await this.allowanceService.listByInvoice(companyTaxId, invoiceNumber);

      return rows.map(toAllowanceDto);
    }

    /** 收到的交換發票（我方為買方）；不帶 status 時回傳全部 */
    @Query(() => [TurnkeyReceivedDocumentDto], { name: 'turnkeyReceivedInvoices' })
    @route(TurnkeyApiAction.READ_RECEIVED)
    async turnkeyReceivedInvoices(
      @Context() context: TurnkeyGraphQLContext,
      @Args('companyTaxId') companyTaxId: string,
      @Args('status', { type: () => TurnkeyReceivedDocumentStatus, nullable: true })
      status?: TurnkeyReceivedDocumentStatus | null,
      @Args('limit', { type: () => Int, nullable: true }) limit?: number | null,
    ): Promise<TurnkeyReceivedDocumentDto[]> {
      await assertCompanyAccess(access, context.req, companyTaxId);

      const rows = await this.receivedService.list(
        companyTaxId,
        RECEIVED_INVOICE_TYPES,
        status ?? undefined,
        limit ?? DEFAULT_LIMIT,
      );

      return rows.map(toReceivedDocumentDto);
    }

    /** 收到的折讓（我方為買方）；不帶 status 時回傳全部 */
    @Query(() => [TurnkeyReceivedDocumentDto], { name: 'turnkeyReceivedAllowances' })
    @route(TurnkeyApiAction.READ_RECEIVED)
    async turnkeyReceivedAllowances(
      @Context() context: TurnkeyGraphQLContext,
      @Args('companyTaxId') companyTaxId: string,
      @Args('status', { type: () => TurnkeyReceivedDocumentStatus, nullable: true })
      status?: TurnkeyReceivedDocumentStatus | null,
      @Args('limit', { type: () => Int, nullable: true }) limit?: number | null,
    ): Promise<TurnkeyReceivedDocumentDto[]> {
      await assertCompanyAccess(access, context.req, companyTaxId);

      const rows = await this.receivedService.list(
        companyTaxId,
        RECEIVED_ALLOWANCE_TYPES,
        status ?? undefined,
        limit ?? DEFAULT_LIMIT,
      );

      return rows.map(toReceivedDocumentDto);
    }
  }

  return TurnkeyQueryResolver;
};
