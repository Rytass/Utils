import { Controller, Get, Inject, NotFoundException, Param, Post, type RawBodyRequest, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { PaymentGateway } from '@rytass/payments';
import { PAYMENTS_GATEWAY } from './typings/symbol';
import { IsPublic } from '@rytass/member-base-nestjs-module';
import { WithServerGateway } from './typings/with-server-gateway.dto';

@Controller('/payments')
export class PaymentsController {
  constructor(
    @Inject(PAYMENTS_GATEWAY)
    private readonly gateway: PaymentGateway & WithServerGateway,
  ) {}

  @IsPublic()
  @Get('/checkout/:orderNo')
  checkout(@Param('orderNo') orderNo: string, @Req() req: RawBodyRequest<Request>, @Res() res: Response): void {
    if (!this.gateway.defaultServerListener) {
      throw new NotFoundException('Page Not Found');
    }

    this.gateway.defaultServerListener(req, res);
  }

  @IsPublic()
  @Post('/callbacks')
  callbacks(@Req() req: RawBodyRequest<Request>, @Res() res: Response): void {
    if (!this.gateway.defaultServerListener) {
      throw new NotFoundException('Page Not Found');
    }

    this.gateway.defaultServerListener(req, res);
  }
}
