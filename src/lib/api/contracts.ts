// Contratos de transporte do backend; não substituem os modelos Supabase ativos.
// Tipagem estática não valida o domínio em runtime. Decimais e BIGINT continuam strings.
export interface UsuarioApi {
  id: string; nome: string; email: string; papel: 'admin' | 'vendedor';
  ativo: boolean; criado_em: string; troca_senha_obrigatoria: boolean;
}
export interface CsrfResponse { csrfToken: string }
export interface UsuarioResponse { usuario: UsuarioApi }
export interface LoginResponse extends UsuarioResponse, CsrfResponse {}
export interface UsuariosResponse { usuarios: UsuarioApi[]; limit: number; offset: number }
export interface MensagemResponse { message: string }
export interface LoginInput { email: string; senha: string }
export interface AlterarSenhaInput { senha_atual: string; nova_senha: string }
export interface AtualizarPerfilInput { nome: string }
export type AuthState =
  | { status: 'unknown' | 'anonymous'; usuario: null }
  | { status: 'authenticated' | 'password_change_required'; usuario: UsuarioApi };
export interface PaginacaoUsuariosInput { limit?: number; offset?: number }
export interface CriarUsuarioInput { nome: string; email: string; senha: string }
// A API revalida a senha quando o papel efetivamente muda; o cliente a exige
// sempre que a alteração de papel é solicitada explicitamente.
export type AtualizarUsuarioInput = { nome?: string; email?: string } & (
  | { papel?: never; senha_admin?: never }
  | { papel: UsuarioApi['papel']; senha_admin: string }
);
export interface StatusUsuarioInput { ativo: boolean; senha_admin: string }
export interface ResetPasswordUsuarioInput { nova_senha: string; senha_admin: string }
export interface ReautenticarAdminInput { senha_admin: string }

export interface ImovelApi {
  id: string; titulo: string; tipo: string;
  preco: string; cidade: string; bairro: string;
  quartos: number | null; banheiros: number | null; vagas: number | null; area: string | null;
  descricao: string | null; imagem_url: string | null; imagens: string[] | null;
  destaque: boolean | null; criado_em: string;
}
export interface ImovelGestaoApi extends ImovelApi { user_id: string | null }
export interface ImovelResponse { imovel: ImovelApi }
export interface ImoveisResponse { imoveis: ImovelApi[]; limit: number; offset: number }
export interface ImoveisGestaoResponse extends Omit<ImoveisResponse, 'imoveis'> { imoveis: ImovelGestaoApi[] }

export interface RegistroHistoricoApi {
  id: string; user_id: string | null; usuario_nome: string | null; usuario_email: string | null;
  acao: 'CREATE' | 'UPDATE' | 'DELETE'; entidade: string; entidade_id: string; descricao: string; criado_em: string;
}
export interface HistoricoResponse { registros: RegistroHistoricoApi[]; limit: number; offset: number; temMais: boolean }
export interface RegistroHistoricoResponse { registro: RegistroHistoricoApi }

export interface CartaContempladaApi {
  id: number; categoria: 'Imóvel' | 'Veículo'; valor_credito_fmt: string; entrada_fmt: string;
  parcelas: number; valor_parcela_fmt: string; administradora: string; administradora_img?: string;
  reserva: 'Reservar' | 'Reservado';
}
export type ContempladosResponse = CartaContempladaApi[];
