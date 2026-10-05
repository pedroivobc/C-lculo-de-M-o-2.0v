/**
 * Telefones no formato E.164 (+5532999990000).
 * O WhatsApp entrega números brasileiros antigos sem o 9 do celular
 * (553299990000), então a identificação procura as duas formas.
 */
export function normalizarTelefone(entrada: string): string | null {
  let d = String(entrada).split('@')[0].replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('0')) d = d.replace(/^0+/, '');
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  if (!d.startsWith('55') || (d.length !== 12 && d.length !== 13)) return null;
  return `+${d}`;
}

/** As duas grafias possíveis de um celular brasileiro (com e sem o nono dígito). */
export function variantesTelefone(e164: string): string[] {
  const d = e164.replace(/\D/g, '');
  const ddd = d.slice(2, 4);
  const numero = d.slice(4);
  if (numero.length === 9 && numero.startsWith('9')) return [`+55${ddd}${numero}`, `+55${ddd}${numero.slice(1)}`];
  if (numero.length === 8 && /^[6-9]/.test(numero)) return [`+55${ddd}9${numero}`, `+55${ddd}${numero}`];
  return [`+${d}`];
}

/** remoteJid da Evolution → E.164. Grupos e listas de transmissão viram null. */
export function telefoneDoJid(jid: string): string | null {
  if (!jid || !jid.endsWith('@s.whatsapp.net')) return null;
  return normalizarTelefone(jid);
}
