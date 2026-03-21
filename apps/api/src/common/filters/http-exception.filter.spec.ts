import { HttpException, HttpStatus } from '@nestjs/common';
import { GlobalExceptionFilter } from './http-exception.filter';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockResponse: { status: jest.Mock; json: jest.Mock };
  let mockRequest: { method: string; url: string };
  let mockHost: { switchToHttp: jest.Mock };

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockRequest = { method: 'GET', url: '/api/v1/test' };
    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    };
  });

  it('should handle HttpException with correct status and format', () => {
    const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

    filter.catch(exception, mockHost as never);

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'NOT_FOUND',
        message: 'Not Found',
        statusCode: 404,
        path: '/api/v1/test',
      }),
    );
    expect(mockResponse.json.mock.calls[0][0]).toHaveProperty('timestamp');
  });

  it('should handle validation errors with details array', () => {
    const exception = new HttpException(
      {
        statusCode: 400,
        message: ['field is required', 'email must be valid'],
        error: 'Bad Request',
      },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, mockHost as never);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'VALIDATION_ERROR',
        message: 'Validation failed',
        statusCode: 400,
        details: ['field is required', 'email must be valid'],
        path: '/api/v1/test',
      }),
    );
  });

  it('should handle generic Error as 500 with safe message in production', () => {
    const originalEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';

    const exception = new Error('Database connection failed');

    filter.catch(exception, mockHost as never);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'INTERNAL_ERROR',
        message: 'Internal server error',
        statusCode: 500,
        path: '/api/v1/test',
      }),
    );
    // Should NOT contain details or the actual error message
    expect(mockResponse.json.mock.calls[0][0]).not.toHaveProperty('details');

    process.env['NODE_ENV'] = originalEnv;
  });
});
