/**
 * Emolumentos de cartório dos estados do piloto (fora de MG): lavratura da escritura e ato de registro com valor declarado.
 * MG continua em ./notas.ts e ./registro.ts, com o detalhamento conferido em recibo.
 *
 * Aqui entra só o ato principal de cada cartório, pela faixa do valor, com os fundos e taxas que o estado soma
 * e o ISS do município. Prenotação, certidões de matrícula, selos e arquivamento não entram (valores pequenos que
 * variam por cartório). Fontes e datas de conferência em docs/piloto-capitais/README.md.
 */

export type UfPiloto = 'SP' | 'RJ' | 'DF' | 'PR' | 'RS' | 'SC';
export const UFS_PILOTO: UfPiloto[] = ['SP', 'RJ', 'DF', 'PR', 'RS', 'SC'];

export interface AtoCartorio { valor: number; nota: string }

const centavos = (n: number) => Math.round(Number((n * 100).toFixed(6))) / 100;
const truncar = (n: number) => Math.floor(Number((n * 100).toFixed(6))) / 100;
const pct = (n: number) => `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

/** Faixa não progressiva: a primeira cujo limite cobre a base; acima da última, a última. */
function faixa<T extends { ate: number }>(tabela: T[], base: number): T {
  return tabela.find((f) => base <= f.ate) ?? tabela[tabela.length - 1];
}

// ---------------- SP ----------------
// Notas: CNB/SP, tabela 2026 da capital (Lei 11.331/2002). O total já traz o ISS de 2% da capital (calculado por dentro).
const SP_NOTAS = (<[number, number][]>[
  [1524, 356.9], [5761, 533.35], [9603, 832.77], [19210, 1189.68], [38420, 1608.08], [76840, 1907.6], [115260, 2264.49],
  [153680, 2682.9], [192100, 3039.89], [230520, 3400.86], [268940, 3815.19], [307360, 4176.24], [330146, 4594.65],
  [384200, 4890.01], [768400, 5427.43], [1152600, 6026.36], [1536800, 6682.74], [2345066, 7384.26], [3908444, 10255.96],
  [5862665, 13332.69], [7816887, 16409.51], [9771109, 19486.25], [11725331, 22562.98], [13679552, 25639.8],
  [15633774, 28716.54], [17587996, 31793.33], [19542217, 34870.18], [Infinity, 65637.95],
]).map(([ate, total]) => ({ ate, total }));
// Registro: ARISP, tabela 2026, item 1 (registro com valor declarado). Total sem ISS; `baseIss` = oficial + Ministério Público.
const SP_REGISTRO = (<[number, number, number][]>[
  [2306, 257.2, 163.56], [5761, 412.72, 262.45], [9603, 740.42, 470.85], [19210, 1098.57, 698.61], [38420, 1335.6, 849.34],
  [115260, 1489.46, 947.18], [192100, 1901.09, 1208.95], [230520, 2311.88, 1470.18], [268940, 2516.87, 1600.53],
  [307360, 2723.02, 1731.63], [345780, 2870.61, 1825.48], [384200, 2945.43, 1873.07], [768400, 3284.18, 2088.48],
  [1152600, 3846.1, 2445.82], [1536800, 4427.79, 2815.72], [1921000, 5009.53, 3185.68], [2305200, 5310.3, 3376.94],
  [3842000, 6814.06, 4333.21], [5763000, 9520.82, 6054.5], [7684000, 12528.33, 7967.04], [9605000, 15535.85, 9879.59],
  [11526000, 18543.37, 11792.14], [13447000, 21550.88, 13704.69], [15368000, 24558.39, 15617.23],
  [17289000, 27565.91, 17529.78], [19210000, 30573.43, 19442.33],
]).map(([ate, total, baseIss]) => ({ ate, total, baseIss }));

// ---------------- RJ ----------------
// TJRJ, Portaria CGJ 2.679/2025 (exercício 2026): Tabela 07 (notas, item 1) e Tabela 05.1 (registro, item 1).
// Emolumento + 2% (atos gratuitos e PMCMV) + fundos (FETJ 20%, FUNPERJ 5%, FUNDPERJ 5%, FUNARPEN 6%) + selo + ISS.
const RJ_NOTAS = (<[number, number, number][]>[
  [21064.17, 331.9, 6.63], [42128.37, 548.45, 10.96], [63192.57, 765.04, 15.3], [84256.79, 938.25, 18.76],
  [112342.37, 1663.03, 33.26], [140427.98, 1963.31, 39.26], [280855.98, 2656.25, 53.12], [561711.99, 2850.22, 57],
]).map(([ate, emol, adicional]) => ({ ate, emol, adicional }));
const RJ_REGISTRO = (<[number, number, number][]>[
  [21064.17, 327.23, 6.54], [42128.37, 540.71, 10.81], [63192.57, 754.28, 15.08], [84256.79, 925.03, 18.5],
  [112342.37, 1639.6, 32.79], [140427.98, 1935.68, 38.71], [280855.98, 2618.85, 52.37], [561711.99, 2818.18, 56.36],
]).map(([ate, emol, adicional]) => ({ ate, emol, adicional }));
/** Acima de R$ 561.711,99: a cada R$ 140.427,98 (ou fração), mais R$ 252,43 de emolumento e R$ 5,04 do adicional de 2%. */
const RJ_EXCEDENTE = { limiar: 561711.99, passo: 140427.98, emol: 252.43, adicional: 5.04 };
const RJ_FUNDOS = [0.2, 0.05, 0.05, 0.06];
const RJ_SELO = 3.27;

// ---------------- DF ----------------
// TJDFT, tabela 2026 (ANOREG-DF): Tabela I item 1.1 e Tabela III item 1. Emolumento + CCRCPN; ISS de 5% sobre o total.
const DF_NOTAS = (<[number, number][]>[
  [9524.89, 439.3], [15272.67, 667.72], [28738.89, 1370.6], [57477.78, 1845.04], [85888.21, 1932.9], [200351.09, 2020.76],
  [343224.42, 2196.48], [858882.16, 2372.2], [1313777.69, 2547.92], [1806444.32, 2723.63], [Infinity, 2899.35],
]).map(([ate, subtotal]) => ({ ate, subtotal }));
const DF_REGISTRO = (<[number, number][]>[
  [32844.44, 667.72], [82111.11, 843.45], [164222.21, 1019.16], [262755.54, 1142.17], [574777.74, 1317.89],
  [870377.72, 1493.61], [1149555.47, 1669.33], [1477999.89, 1845.04], [1970666.52, 2020.76], [Infinity, 2196.48],
]).map(([ate, subtotal]) => ({ ate, subtotal }));

// ---------------- PR ----------------
// Lei estadual 21.869/2023 (VRCext R$ 0,277 desde 01/01/2024; o reajuste do PL 1.016/2025 não foi votado):
// Tabela XI item IV (escrituras) e Tabela XIII item XIII-b (registro). Tabelas não progressivas.
const VRC = 0.277;
const PR_NOTAS = (<[number, number][]>[
  [56000, 1260], [66000, 1485], [76000, 1710], [86000, 1935], [96000, 2160], [106000, 2385], [116000, 2610], [126000, 2835],
  [136000, 3060], [146000, 3285], [156000, 3510], [166000, 3652], [176000, 3872], [186000, 4092], [196000, 4312],
  [206000, 4532], [216000, 4752], [Infinity, 4972],
]).map(([ate, vrc]) => ({ ate, vrc }));
const PR_REGISTRO = PR_NOTAS.filter((f) => f.ate <= 186000).concat({ ate: Infinity, vrc: 4312 });
/** FUNDEP: 5% sobre os emolumentos. */
const PR_FUNDEP = 0.05;
/** Funrejus: 0,2% do valor do negócio, pago uma vez (na escritura ou, sem escritura, no registro). Teto de 53 UPF/PR. */
export const FUNREJUS = { aliquota: 0.002, teto: 7950 };

// ---------------- RS ----------------
// TJRS, tabela 2026 (reajuste de 5,86%): Notas item 1 e Registro de Imóveis item 1. Valores já com o
// processamento eletrônico de dados (R$ 7,30 por ato).
const RS_PROCESSAMENTO = 7.3;
const RS_NOTAS = (<[number, number][]>[
  [2481.8, 230.1], [7445.2, 259.8], [12408.7, 299.7], [18612.9, 353.4], [24816.8, 402.9], [37225.2, 475.4], [49633.8, 560],
  [74451, 636], [99267.8, 735.9], [124085, 835.8], [148901.6, 935.4], [198535.7, 1084], [248169.5, 1284.4],
  [297803.6, 1483.1], [347437.3, 1682.6], [397071, 1897.1], [446705, 2082.3], [496338.9, 2281.7], [545972.8, 2481],
  [595606.8, 2680.5], [645240.7, 2878.9], [694874.6, 3079.6], [744508.5, 3279.2], [992677.9, 3877.4],
  [1240847.6, 4874.8], [Infinity, 5490.2],
]).map(([ate, total]) => ({ ate, total }));
const RS_REGISTRO = (<[number, number][]>[
  [2481.8, 233.4], [4963.4, 238.1], [7445.2, 248.3], [9927, 258.4], [12408.7, 268.2], [14890.1, 278.3], [17371.5, 288.6],
  [19853.7, 298.6], [22335.1, 308], [24816.8, 317.7], [37225.2, 348.2], [49633.8, 398.1], [74451, 473.2], [99267.8, 572.8],
  [124085, 672.2], [148901.6, 772], [173718.6, 871.9], [198535.7, 971.5], [223352.7, 1071.5], [248169.5, 1171.2],
  [297803.6, 1320.6], [347437.3, 1519.6], [397071, 1719.3], [446705, 1918.6], [496338.9, 2119], [620424, 2468.1],
  [744508.5, 2966.2], [868593.3, 3465.3], [992677.9, 3963.5], [1116762.8, 4462.2], [1240847.6, 4960.9], [Infinity, 5490.2],
]).map(([ate, total]) => ({ ate, total }));

// ---------------- SC ----------------
// LC estadual 755/2019 (alterada pela LC 846/2023), valores de 2026 corrigidos pelo INPC (Circular CGJ 643/2025).
// Registro: Tabela III item 2.2, conferido na tabela 2026 publicada por cartório de SC. Notas: Tabela I item 2, com o
// mesmo fator de correção do registro (1,37859 sobre os valores de 2020). FRJ de 22,73% sobre os emolumentos.
const SC_LIMITES = [13786.59, 20679.87, 28951.83, 35845.12, 44117.08, 53767.69, 62039.64, 71690.25, 79962.21, 90991.48,
  100642.09, 111671.36, 122700.64, 133729.9, 146137.83, 158545.76, 170953.69, 184740.27, 198526.88, 212313.47, 226100.05];
const SC_REGISTRO = [162.65, 184.73, 263.31, 343.27, 428.76, 516.98, 607.98, 703.11, 802.37, 904.39, 1010.55, 1122.22,
  1222.85, 1324.88, 1429.66, 1535.82, 1643.35, 1752.26, 1863.93, 1976.99, 2091.41].map((emol, i) => ({ ate: SC_LIMITES[i], emol }));
const SC_NOTAS_2020 = [124, 143, 203, 265, 331, 399, 470, 543, 619, 698, 781, 866, 955, 1047, 1142, 1213, 1284, 1353, 1421, 1488, 1554];
const SC_NOTAS = SC_NOTAS_2020.map((v, i) => ({ ate: SC_LIMITES[i], emol: centavos(v * 1.37859) }));
/** Acima da última faixa: mais R$ 50,00 a cada R$ 50 mil (ou fração), até 71 acréscimos (item 2.2.92). */
const SC_EXCEDENTE = { passo: 50000, valor: 50, max: 71 };
const SC_FRJ = 0.2273;

function emolSc(tabela: { ate: number; emol: number }[], base: number) {
  const ultima = tabela[tabela.length - 1];
  if (base <= ultima.ate) return faixa(tabela, base).emol;
  const n = Math.min(SC_EXCEDENTE.max, Math.ceil((base - ultima.ate) / SC_EXCEDENTE.passo));
  return centavos(ultima.emol + n * SC_EXCEDENTE.valor);
}

function emolRj(tabela: { ate: number; emol: number; adicional: number }[], base: number) {
  const f = faixa(tabela, base);
  if (base <= RJ_EXCEDENTE.limiar) return f;
  const n = Math.ceil((base - RJ_EXCEDENTE.limiar) / RJ_EXCEDENTE.passo);
  return { emol: centavos(f.emol + n * RJ_EXCEDENTE.emol), adicional: centavos(f.adicional + n * RJ_EXCEDENTE.adicional) };
}

/** RJ: na 1ª aquisição residencial pelo SFH, 50% nos emolumentos e sem os fundos (nota 7ª da Tabela 07). */
function valorRj(emol: number, adicional: number, iss: number, reducao: number) {
  const e = centavos(emol * (1 - reducao));
  const ad = centavos(adicional * (1 - reducao));
  const fundos = reducao ? 0 : RJ_FUNDOS.reduce((s, p) => s + truncar(emol * p), 0);
  return centavos(e + ad + fundos + RJ_SELO + centavos(e * iss));
}

type Cartorio = 'notas' | 'registro';

/** Valor de um ato com valor declarado no cartório de `uf`. `reducao` = 0,5 na 1ª aquisição pelo SFH (art. 290 da Lei 6.015/73). */
export function atoCartorio(uf: UfPiloto, cartorio: Cartorio, base: number, iss: number, reducao = 0): AtoCartorio {
  const red = reducao ? ` · redução de ${pct(reducao)}` : '';
  switch (uf) {
    case 'SP': {
      if (cartorio === 'notas') {
        const f = faixa(SP_NOTAS, base);
        return { valor: centavos(f.total * (1 - reducao)), nota: `Tabela do CNB/SP 2026 (capital) · ISS de 2% incluído${red}` };
      }
      const f = faixa(SP_REGISTRO, base);
      const issSp = centavos(f.baseIss * iss / (1 - iss));
      return { valor: centavos((f.total + issSp) * (1 - reducao)), nota: `Tabela da ARISP 2026 · ISS ${pct(iss)}${red}` };
    }
    case 'RJ': {
      const { emol, adicional } = emolRj(cartorio === 'notas' ? RJ_NOTAS : RJ_REGISTRO, base);
      return { valor: valorRj(emol, adicional, iss, reducao), nota: `Tabela do TJRJ 2026 + fundos (36%) + selo · ISS ${pct(iss)}${red}` };
    }
    case 'DF': {
      const f = faixa(cartorio === 'notas' ? DF_NOTAS : DF_REGISTRO, base);
      const sub = centavos(f.subtotal * (1 - reducao));
      return { valor: centavos(sub + centavos(sub * iss)), nota: `Tabela do TJDFT 2026 · ISS ${pct(iss)}${red}` };
    }
    case 'PR': {
      const f = faixa(cartorio === 'notas' ? PR_NOTAS : PR_REGISTRO, base);
      const emol = centavos(centavos(f.vrc * VRC) * (1 - reducao));
      return {
        valor: centavos(emol + centavos(emol * PR_FUNDEP) + centavos(emol * iss)),
        nota: `${f.vrc.toLocaleString('pt-BR')} VRC (Lei 21.869/2023) + FUNDEP 5% · ISS ${pct(iss)}${red}`,
      };
    }
    case 'RS': {
      const f = faixa(cartorio === 'notas' ? RS_NOTAS : RS_REGISTRO, base);
      const emol = centavos((f.total - RS_PROCESSAMENTO) * (1 - reducao));
      return { valor: centavos(emol + RS_PROCESSAMENTO + centavos(emol * iss)), nota: `Tabela do TJRS 2026 · ISS ${pct(iss)}${red}` };
    }
    case 'SC': {
      const emol = centavos(emolSc(cartorio === 'notas' ? SC_NOTAS : SC_REGISTRO, base) * (1 - reducao));
      return { valor: centavos(emol + centavos(emol * SC_FRJ) + centavos(emol * iss)), nota: `LC 755/2019 (2026) + FRJ 22,73% · ISS ${pct(iss)}${red}` };
    }
  }
}

/** Funrejus do PR sobre o valor do negócio, ou null nos outros estados. */
export function taxaTransmissao(uf: UfPiloto, base: number): AtoCartorio | null {
  if (uf !== 'PR') return null;
  return { valor: centavos(Math.min(base * FUNREJUS.aliquota, FUNREJUS.teto)), nota: 'Funrejus: 0,2% do valor (Lei estadual 12.216/1998)' };
}
