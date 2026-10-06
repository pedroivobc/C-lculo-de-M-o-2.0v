/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Número do agente no WhatsApp, com DDI (ex.: 5532988887777) */
  readonly VITE_AGENTE_WHATSAPP?: string
  /** "true" para bloquear o app sem assinatura ativa (ligar quando o pagamento existir) */
  readonly VITE_EXIGIR_ASSINATURA?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
