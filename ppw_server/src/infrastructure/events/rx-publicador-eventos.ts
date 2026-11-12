import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { EventoPedido, PublicadorEventos } from '../../application/ports/publicador-eventos';

// Barramento de eventos em memória (padrão Observer com RxJS).
// Cada conexão SSE é um "observador" que assina eventos$.
// Limitação: só funciona com UMA instância do servidor. Com várias réplicas,
// trocaríamos por LISTEN/NOTIFY do PostgreSQL ou Redis Pub/Sub sem mudar os casos de uso.
@Injectable()
export class RxPublicadorEventos extends PublicadorEventos {
  private readonly subject = new Subject<EventoPedido>();
  readonly eventos$: Observable<EventoPedido> = this.subject.asObservable();

  publicar(evento: EventoPedido): void {
    this.subject.next(evento);
  }
}
