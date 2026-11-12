import { InjectionToken, Provider, Type } from '@nestjs/common';

// Os casos de uso são classes puras, sem decorators do Nest.
// Este helper ensina o Nest a criá-los, passando as dependências (repositórios) no construtor.
export function useCaseProvider<T>(useCase: Type<T>, dependencias: InjectionToken[]): Provider {
  return {
    provide: useCase,
    useFactory: (...args: unknown[]) => new useCase(...args),
    inject: dependencias,
  };
}
