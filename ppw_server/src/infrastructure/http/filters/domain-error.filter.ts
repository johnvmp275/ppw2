import { ArgumentsHost, BadRequestException, Catch, ExceptionFilter, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { DomainError, NotFoundError } from '../../../domain/errors/domain.error';

// Traduz os erros do domínio para respostas HTTP.
// O corpo segue o padrão do Nest ({ statusCode, message, error }), que o front já sabe ler.
@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter {
  catch(error: DomainError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const httpError =
      error instanceof NotFoundError ? new NotFoundException(error.message) : new BadRequestException(error.message);

    response.status(httpError.getStatus()).json(httpError.getResponse());
  }
}
