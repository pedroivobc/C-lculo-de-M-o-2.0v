import { describe, expect, it } from 'vitest';
import { carteira, classificar, faixas, indicadores, mensalEquivalente, vigente, type AssinaturaLinha, type OrgLinha } from './gestao';
import { preco, precoEquipe } from '../src/lib/planos';

const AGORA = Date.parse('2026-10-09T15:00:00Z');
const diasAtras = (n: number) => new Date(AGORA - n * 86_400_000).toISOString();
const sub = (x: Partial<AssinaturaLinha>): AssinaturaLinha => ({
  user_id: 'u1', plan: 'anual', nivel: 'pro', status: 'ativa', gateway: 'stripe',
  created_at: diasAtras(100), updated_at: diasAtras(100), current_period_end: diasAtras(-200), ...x,
});

describe('faixas do período', () => {
  it('30 dias: um ponto por dia, o último é hoje', () => {
    const f = faixas(30, AGORA);
    expect(f.granularidade).toBe('dia');
    expect(f.faixas).toHaveLength(30);
    expect(f.faixas[29].rotulo).toBe('09/10');
    expect(f.faixas[29].ate).toBe(AGORA);
  });
  it('90 dias por semana e 365 por mês', () => {
    expect(faixas(90, AGORA).granularidade).toBe('semana');
    const ano = faixas(365, AGORA);
    expect(ano.granularidade).toBe('mes');
    expect(ano.faixas).toHaveLength(12);
    expect(ano.faixas[11].rotulo).toBe('out/26');
  });
});

describe('vigência e MRR', () => {
  it('cancelada vale até o cancelamento; pendente nunca vale', () => {
    const s = sub({ status: 'cancelada', updated_at: diasAtras(10) });
    expect(vigente(s, Date.parse(diasAtras(20)))).toBe(true);
    expect(vigente(s, AGORA)).toBe(false);
    expect(vigente(sub({ status: 'pendente' }), AGORA)).toBe(false);
    expect(vigente(sub({ current_period_end: diasAtras(1) }), AGORA)).toBe(false);
  });
  it('mensal equivalente pelo período contratado e pelo tamanho da equipe', () => {
    expect(mensalEquivalente(sub({ nivel: 'pro', plan: 'anual' }), [])).toBe(preco('pro', 'anual').porMes);
    const org: OrgLinha = { id: 'o', nome: 'Imob', tipo: 'teams', dono_id: 'u1', assentos_base: 5, usuarios: 7 };
    expect(mensalEquivalente(sub({ nivel: 'teams', plan: 'semestral' }), [org])).toBe(Math.round(precoEquipe(7, 5).mensal * 0.9));
  });
  it('liberação manual fica fora; cliente com duas assinaturas conta uma vez', () => {
    const c = carteira([sub({}), sub({ nivel: 'usuario' }), sub({ user_id: 'u2', gateway: 'manual' })], [], AGORA);
    expect(c.clientes.size).toBe(1);
    expect(c.mrr).toBe(preco('pro', 'anual').porMes);
  });
  it('Unlimited do administrador não é cobrado nem entra no MRR', () => {
    const c = carteira([sub({ nivel: 'unlimited', gateway: 'manual', current_period_end: null })], [], AGORA);
    expect(c.clientes.size).toBe(0);
    expect(c.mrr).toBe(0);
  });
});

describe('indicadores', () => {
  const perfis = [
    { id: 'adm', papel: 'admin', created_at: diasAtras(400) },
    { id: 'u1', papel: 'pro', created_at: diasAtras(200) },
    { id: 'u2', papel: 'trial', created_at: diasAtras(5) },
    { id: 'u3', papel: 'pro', created_at: diasAtras(50) },
  ];
  const assinaturas = [
    sub({}),
    sub({ user_id: 'u3', created_at: diasAtras(40), status: 'cancelada', updated_at: diasAtras(3) }),
    sub({ user_id: 'adm', created_at: diasAtras(10) }),
  ];
  const calculos = [
    { user_id: 'u1', tipo: 'escritura', origem: 'site', municipio: 'mg-juiz-de-fora', created_at: diasAtras(2) },
    { user_id: 'u1', tipo: 'escritura', origem: 'whatsapp', municipio: 'mg-juiz-de-fora', created_at: diasAtras(1) },
    { user_id: 'u2', tipo: 'doacao', origem: 'site', municipio: null, created_at: diasAtras(4) },
    { user_id: 'u1', tipo: 'escritura', origem: 'site', municipio: 'mg-juiz-de-fora', created_at: diasAtras(45) },
  ];
  const r = indicadores({ perfis, assinaturas, calculos, orgs: [] }, 30, AGORA);

  it('assinantes, novos e churn sem contar o admin', () => {
    expect(r.financeiro.assinantes).toEqual({ valor: 1, anterior: 2 });
    expect(r.financeiro.novosAssinantes.valor).toBe(0);
    expect(r.financeiro.novosAssinantes.anterior).toBe(1);
    expect(r.financeiro.churn.valor).toBe(50);
    expect(r.financeiro.receitaRecebida.valor).toBeNull();
  });
  it('uso no período e no anterior', () => {
    expect(r.uso.orcamentos).toEqual({ valor: 3, anterior: 1 });
    expect(r.uso.usuariosAtivos).toEqual({ valor: 2, anterior: 1 });
    expect(r.uso.orcamentosWhatsapp.valor).toBe(1);
    expect(r.base.cadastrados).toEqual({ valor: 3, anterior: 2 });
    expect(r.base.novosUsuarios.valor).toBe(1);
    expect(r.porOperacao[0]).toMatchObject({ chave: 'escritura', quantidade: 2 });
    expect(r.porMunicipio.find((m) => m.chave === 'nao_informado')?.nome).toBe('Não informado');
    expect(r.serie.reduce((s, x) => s + x.orcamentos, 0)).toBe(3);
  });
  it('sem base, a conversão e o churn ficam "não aplicável" (null)', () => {
    const vazio = indicadores({ perfis: [], assinaturas: [], calculos: [], orgs: [] }, 7, AGORA);
    expect(vazio.base.conversao.valor).toBeNull();
    expect(vazio.financeiro.churn.valor).toBeNull();
  });
});

describe('classificação de usuários', () => {
  it('nunca, ativo, em risco, inativo e power user', () => {
    expect(classificar(null, 0, AGORA).situacao).toBe('nunca');
    expect(classificar(diasAtras(3), 25, AGORA)).toEqual({ situacao: 'ativo', power: true });
    expect(classificar(diasAtras(20), 1, AGORA).situacao).toBe('em_risco');
    expect(classificar(diasAtras(40), 0, AGORA).situacao).toBe('inativo');
  });
});
