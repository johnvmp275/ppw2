import { Controller, Get } from '@nestjs/common';
import { Usuario } from '../../../domain/entities/usuario.entity';
import { UsuarioRepository } from '../../../domain/repositories/usuario.repository';
import { Publico, UsuarioAtual } from '../auth/autenticacao.guard';

const toHttp = (usuario: Usuario) => ({ id: usuario.id, nome: usuario.nome, papel: usuario.papel });

@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarioRepository: UsuarioRepository) {}

  // Lista os perfis para o seletor do front (substitui uma tela de login)
  @Publico()
  @Get()
  async findAll() {
    return (await this.usuarioRepository.findAll()).map(toHttp);
  }

  @Get('eu')
  eu(@UsuarioAtual() usuario: Usuario) {
    return toHttp(usuario);
  }
}
