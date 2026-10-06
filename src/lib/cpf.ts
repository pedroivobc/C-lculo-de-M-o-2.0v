/** CPF: só dígitos, dígitos verificadores e máscara. Usado no cadastro (site) e no servidor. */
export const soDigitosCpf = (cpf: string) => cpf.replace(/\D/g, '').slice(0, 11);

export function cpfValido(cpf: string): boolean {
  const d = soDigitosCpf(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

/** "12345678909" → "123.456.789-09" (aceita parcial, para a máscara enquanto digita). */
export function mascararCpf(cpf: string): string {
  const d = soDigitosCpf(cpf);
  return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
}
