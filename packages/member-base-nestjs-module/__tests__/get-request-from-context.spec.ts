import { ExecutionContext } from '@nestjs/common';
import { getRequestFromContext } from '../src/utils/get-request-from-context';

describe('getRequestFromContext', () => {
  describe('HTTP context', () => {
    it('should return request from HTTP context', () => {
      const mockRequest = { payload: { id: 'test-id', account: 'test-account' } };
      const mockContext = {
        getType: jest.fn().mockReturnValue('http'),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      const result = getRequestFromContext(mockContext);

      expect(mockContext.getType).toHaveBeenCalled();
      expect(mockContext.switchToHttp).toHaveBeenCalled();
      expect(result).toBe(mockRequest);
    });
  });

  describe('GraphQL context', () => {
    it('should return request from GraphQL context', () => {
      const mockRequest = { payload: { id: 'test-id', account: 'test-account' } };
      const mockContext = {
        getType: jest.fn().mockReturnValue('graphql'),
      } as unknown as ExecutionContext;

      jest.doMock('@nestjs/graphql', () => ({
        GqlExecutionContext: {
          create: jest.fn().mockReturnValue({
            getContext: jest.fn().mockReturnValue({ req: mockRequest }),
          }),
        },
      }));

      const { GqlExecutionContext } = jest.requireMock('@nestjs/graphql');

      GqlExecutionContext.create.mockReturnValue({
        getContext: () => ({ req: mockRequest }),
      });

      const result = getRequestFromContext(mockContext);

      expect(mockContext.getType).toHaveBeenCalled();
      expect(result).toBe(mockRequest);
    });
  });

  describe('Unknown context type', () => {
    it('should default to HTTP context for unknown types', () => {
      const mockRequest = { payload: { id: 'test-id' } };
      const mockContext = {
        getType: jest.fn().mockReturnValue('unknown'),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      const result = getRequestFromContext(mockContext);

      expect(mockContext.switchToHttp).toHaveBeenCalled();
      expect(result).toBe(mockRequest);
    });
  });
});
