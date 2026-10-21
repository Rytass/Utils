import { CanActivate, ExecutionContext, ForbiddenException, Type } from '@nestjs/common';
import type { Request } from 'express';
import { TurnkeyRouteAccess } from './turnkey-rest.options';

/** 依 canAccessCompany 決定呼叫者能不能代表路徑上的統編；未設定時預設拒絕 */
export const createCompanyAccessGuard = (access: TurnkeyRouteAccess): Type<CanActivate> => {
  class TurnkeyCompanyAccessGuard implements CanActivate {
    async canActivate(context: ExecutionContext): Promise<boolean> {
      const request = context.switchToHttp().getRequest<Request>();
      const companyTaxId = request.params?.companyTaxId;

      if (!companyTaxId || !/^\d{8}$/.test(companyTaxId)) throw new ForbiddenException('Invalid company tax id');

      if (access.allowAllCompanies) return true;

      if (!access.canAccessCompany) throw new ForbiddenException('Company access is not configured');

      if (!(await access.canAccessCompany(request, companyTaxId))) {
        throw new ForbiddenException('Cannot access this company');
      }

      return true;
    }
  }

  return TurnkeyCompanyAccessGuard;
};
