import { CanActivate, ExecutionContext, Injectable, SetMetadata, createParamDecorator } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Usuario } from '../../../domain/entities/usuario.entity';
import { NaoAutenticadoError } from '../../../domain/errors/domain.error';
import { UsuarioRepository } from '../../../domain/repositories/usuario.repository';

export const HEADER_USUARIO = 'x-usuario-id';
const ROTA_PUBLICA = 'rotaPublica';

// Marca rotas que não exigem usuário (cardápio, acompanhamento do cliente, SSE)
export const Publico = () => SetMetadata(ROTA_PUBLICA, true);

type RequestComUsuario = Request & { usuario?: Usuario };

// Identificação simplificada (projeto acadêmico, sem tela de login): o front manda o id
// do usuário no header X-Usuario-Id. O PAPEL nunca vem do cliente: é lido do banco,
// então trocar o header não dá mais poder do que o usuário cadastrado tem.
// Em produção isso seria um JWT assinado; a regra de permissão (RBAC) não mudaria.
@Injectable()
export class AutenticacaoGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly usuarioRepository: UsuarioRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const publica = this.reflector.getAllAndOverride<boolean>(ROTA_PUBLICA, [context.getHandler(), context.getClass()]);
    if (publica) return true;

    const request = context.switchToHttp().getRequest<RequestComUsuario>();
    const id = request.header(HEADER_USUARIO);
    if (!id) {
      throw new NaoAutenticadoError('Identifique-se: escolha um perfil (header X-Usuario-Id)');
    }

    const usuario = await this.usuarioRepository.findById(id);
    if (!usuario || !usuario.ativo) {
      throw new NaoAutenticadoError('Usuário não encontrado ou inativo');
    }

    request.usuario = usuario;
    return true;
  }
}

export const UsuarioAtual = createParamDecorator((_dados: unknown, context: ExecutionContext): Usuario => {
  return context.switchToHttp().getRequest<RequestComUsuario>().usuario!;
});
