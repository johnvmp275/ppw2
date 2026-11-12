import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';

// No Express 5 o body fica undefined quando a requisição não tem corpo JSON.
// Trocamos por {} para que a entidade responda com a mensagem de validação (400) em vez de um erro 500.
@Injectable()
export class DefaultBodyPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    return metadata.type === 'body' && value === undefined ? {} : value;
  }
}
