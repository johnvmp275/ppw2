import { Usuario } from '../entities/usuario.entity';

export abstract class UsuarioRepository {
  abstract findAll(): Promise<Usuario[]>;
  abstract findById(id: string): Promise<Usuario | null>;
}
