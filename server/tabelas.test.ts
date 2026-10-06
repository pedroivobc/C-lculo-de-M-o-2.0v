import ExcelJS from 'exceljs';
import { afterEach, describe, expect, it } from 'vitest';
import { calcular, definirParametros, PARAMETROS_2026 } from '../src/lib/calc';
import { compararTabelas, gerarPlanilha, lerPlanilha } from './tabelas';

afterEach(() => definirParametros(PARAMETROS_2026));

/** Abre a planilha gerada, aplica uma edição e devolve o arquivo, como o admin faria no Excel. */
async function editar(arquivo: Buffer, mudar: (wb: ExcelJS.Workbook) => void) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(arquivo as unknown as ArrayBuffer);
  mudar(wb);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('tabelas anuais por planilha', () => {
  it('a planilha baixada volta igual ao ser enviada (emolumentos, INCC e ITBI de JF)', async () => {
    const e = await lerPlanilha('emolumentos', await gerarPlanilha('emolumentos', PARAMETROS_2026), 2026);
    expect(e).toEqual(PARAMETROS_2026.emolumentos);
    expect(await lerPlanilha('incc', await gerarPlanilha('incc', PARAMETROS_2026), 2026)).toEqual(PARAMETROS_2026.incc);
    expect(await lerPlanilha('itbiJf', await gerarPlanilha('itbiJf', PARAMETROS_2026), 2026)).toEqual(PARAMETROS_2026.itbiJf);
  });

  it('emolumentos de 2027 com reajuste de 5% mudam o cálculo', async () => {
    const arquivo = await editar(await gerarPlanilha('emolumentos', PARAMETROS_2026), (wb) => {
      for (const nome of ['Faixas', 'Excedente', 'Cancelamento', 'Atos fixos']) {
        const ws = wb.getWorksheet(nome)!;
        const [colBruto, colTfj] = nome === 'Excedente' || nome === 'Atos fixos' ? [4, 5] : [3, 4];
        ws.eachRow((row, n) => {
          if (n === 1) return;
          for (const c of [colBruto, colTfj]) row.getCell(c).value = Math.round(Number(row.getCell(c).value) * 105) / 100;
        });
      }
    });
    const nova = await lerPlanilha('emolumentos', arquivo, 2027);
    const cmp = compararTabelas('emolumentos', nova);
    expect(cmp.variacao!.media).toBeCloseTo(5, 0);
    expect(cmp.avisos).toEqual([]);
    const antes = calcular('escritura', { subtipo: 'compra_venda_simples', valorDeclarado: 350000 }).total;
    definirParametros({ emolumentos: nova });
    const depois = calcular('escritura', { subtipo: 'compra_venda_simples', valorDeclarado: 350000 });
    expect(depois.total).toBeGreaterThan(antes);
    expect(depois.linhas.find((l) => l.rotulo === 'Registro')!.nota).toContain('(2027)');
  });

  it('INCC de 2027: exige a linha do ano novo e passa a corrigir até 2027', async () => {
    const base = await gerarPlanilha('incc', PARAMETROS_2026);
    await expect(lerPlanilha('incc', base, 2027)).rejects.toThrow(/Acrescente a linha de 2027/);
    const arquivo = await editar(base, (wb) => wb.getWorksheet('INCC')!.addRow([2027, 172.1]));
    const nova = await lerPlanilha('incc', arquivo, 2027);
    expect(compararTabelas('incc', nova).linhas).toEqual([expect.objectContaining({ item: 'INCC 2027 (novo)', depois: '172.1' })]);
    definirParametros({ incc: nova });
    expect(calcular('correcao', { valorOriginal: 100000, anoContrato: 2026 }).total).toBe(Math.round((100000 / 165.54) * 172.1 * 100) / 100);
  });

  it('base do ITBI de JF de 2027 muda o desconto do SFH', async () => {
    const arquivo = await editar(await gerarPlanilha('itbiJf', PARAMETROS_2026), (wb) => {
      wb.getWorksheet('ITBI Juiz de Fora')!.getRow(2).getCell(2).value = '112.000,00';
    });
    const nova = await lerPlanilha('itbiJf', arquivo, 2027);
    expect(nova).toEqual({ ano: 2027, limiarSfh: 112000, aliquotaFinanciado: 0.005 });
    const itbi = () => calcular('financiamento_caixa', { modalidade: 'SBPE', valorDeclarado: 400000, valorFinanciado: 300000 }).linhas.find((l) => l.rotulo.startsWith('ITBI'))!.valor;
    const antes = itbi();
    definirParametros({ itbiJf: nova });
    expect(itbi()).toBeLessThan(antes);
  });

  it('explica o erro quando a planilha está errada', async () => {
    const arquivo = await editar(await gerarPlanilha('emolumentos', PARAMETROS_2026), (wb) => {
      wb.getWorksheet('Faixas')!.getRow(3).getCell(1).value = 1000; // fora de ordem
    });
    await expect(lerPlanilha('emolumentos', arquivo, 2027)).rejects.toThrow(/ordem crescente/);
    await expect(lerPlanilha('emolumentos', Buffer.from('não é xlsx'), 2027)).rejects.toThrow(/\.xlsx/);
  });
});
