import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import {
  ConflitoError,
  DomainError,
  NaoAutenticadoError,
  NotFoundError,
  PermissaoNegadaError,
  RegraNegocioError,
} from '../../../domain/errors/domain.error';

// Erros do PostgreSQL (SQLSTATE) que podem escapar se alguma validação do código falhar.
// O banco é a última barreira, e a resposta continua sendo um erro de negócio, não um 500.
const ERROS_BANCO: Record<string, { status: HttpStatus; mensagem: string }> = {
  '23505': { status: HttpStatus.CONFLICT, mensagem: 'Registro duplicado' },
  '23503': { status: HttpStatus.CONFLICT, mensagem: 'O registro está ligado a outro que não existe ou ainda está em uso' },
  '23514': { status: HttpStatus.UNPROCESSABLE_ENTITY, mensagem: 'Os dados violam uma regra do banco' },
  '23000': { status: HttpStatus.UNPROCESSABLE_ENTITY, mensagem: 'Operação não permitida pela integridade do banco' },
  '40001': { status: HttpStatus.CONFLICT, mensagem: 'Conflito com outra operação simultânea. Tente de novo' },
  '40P01': { status: HttpStatus.CONFLICT, mensagem: 'Conflito com outra operação simultânea. Tente de novo' },
};

function statusDoErroDeDominio(error: DomainError): HttpStatus {
  if (error instanceof NotFoundError) return HttpStatus.NOT_FOUND;
  if (error instanceof NaoAutenticadoError) return HttpStatus.UNAUTHORIZED;
  if (error instanceof PermissaoNegadaError) return HttpStatus.FORBIDDEN;
  if (error instanceof ConflitoError) return HttpStatus.CONFLICT;
  if (error instanceof RegraNegocioError) return HttpStatus.UNPROCESSABLE_ENTITY;
  return HttpStatus.BAD_REQUEST;
}

// Traduz erros para respostas HTTP no formato do Nest ({ statusCode, message, error }),
// que o front já sabe ler.
@Catch()
export class DomainErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainErrorFilter.name);

  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (error instanceof HttpException) {
      response.status(error.getStatus()).json(error.getResponse());
      return;
    }

    if (error instanceof DomainError) {
      const status = statusDoErroDeDominio(error);
      response.status(status).json({ statusCode: status, message: error.message, error: error.name });
      return;
    }

    const codigo = (error as { code?: string })?.code;
    const erroBanco = codigo ? ERROS_BANCO[codigo] : undefined;
    if (erroBanco) {
      this.logger.warn(`Erro de banco ${codigo}: ${(error as Error).message}`);
      response
        .status(erroBanco.status)
        .json({ statusCode: erroBanco.status, message: erroBanco.mensagem, error: `SQLSTATE ${codigo}` });
      return;
    }

    this.logger.error(error);
    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ statusCode: 500, message: 'Erro interno no servidor', error: 'Internal Server Error' });
  }
}
