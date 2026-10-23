import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { ABA_PARCEIROS, lerPlanilhaParceiros, modeloParceiros } from './parceirosPlanilha';

async function preencher(linhas: unknown[][]) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await modeloParceiros() as unknown as ArrayBuffer);
  const ws = wb.getWorksheet(ABA_PARCEIROS)!;
  linhas.forEach((l) => ws.addRow(l));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('planilha de corretores parceiros', () => {
  it('lê o modelo preenchido e pula linhas em branco', async () => {
    const r = await lerPlanilhaParceiros(await preencher([
      ['Maria Souza', 'Imobiliária Centro', '(32) 99999-0000', 'maria@x.com'],
      [],
      ['João', 'Casa & Lar', 32988887777, null],
    ]));
    expect(r).toEqual([
      { linha: 2, nome: 'Maria Souza', imobiliaria: 'Imobiliária Centro', telefone: '(32) 99999-0000', email: 'maria@x.com' },
      { linha: 4, nome: 'João', imobiliaria: 'Casa & Lar', telefone: '32988887777', email: '' },
    ]);
  });

  it('recusa planilha sem as colunas obrigatórias ou vazia', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('X').addRow(['Nome', 'Telefone']);
    await expect(lerPlanilhaParceiros(Buffer.from(await wb.xlsx.writeBuffer()))).rejects.toThrow(/Imobiliária/);
    await expect(lerPlanilhaParceiros(await preencher([]))).rejects.toThrow(/Nenhum parceiro/);
    await expect(lerPlanilhaParceiros(Buffer.from('nada'))).rejects.toThrow(/abrir o arquivo/);
  });
});
