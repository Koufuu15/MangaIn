import 'dotenv/config'

export const env = {
  port: Number(process.env.PORT || 3000),
  ollamaHost:
    process.env.OLLAMA_HOST || 'http://127.0.0.1:11434',
  ollamaModel: process.env.OLLAMA_MODEL?.trim(),
  cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID?.trim(),
  cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN?.trim(),
  cloudflareAiModel:
    process.env.CLOUDFLARE_AI_MODEL?.trim() ||
    '@cf/black-forest-labs/flux-2-klein-4b',
  cloudflareAiTimeoutMs: Number(
    process.env.CLOUDFLARE_AI_TIMEOUT_MS || 5 * 60 * 1000,
  ),
}

if (!Number.isInteger(env.port) || env.port < 1 || env.port > 65535) {
  throw new Error('PORTの設定が正しくありません。')
}

if (!env.ollamaModel) {
  throw new Error('OLLAMA_MODELをbackend/.envに設定してください。')
}

if (
  !Number.isInteger(env.cloudflareAiTimeoutMs) ||
  env.cloudflareAiTimeoutMs < 10_000 ||
  env.cloudflareAiTimeoutMs > 15 * 60 * 1000
) {
  throw new Error(
    'CLOUDFLARE_AI_TIMEOUT_MSは10000〜900000の整数で設定してください。',
  )
}