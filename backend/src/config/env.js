import 'dotenv/config'

export const env = {
  port: Number(process.env.PORT || 3000),
  ollamaHost:
    process.env.OLLAMA_HOST || 'http://127.0.0.1:11434',
  ollamaModel: process.env.OLLAMA_MODEL?.trim(),
  comfyUiHost:
    process.env.COMFYUI_HOST || 'http://127.0.0.1:8188',
  comfyUiTimeoutMs: Number(process.env.COMFYUI_TIMEOUT_MS || 15 * 60 * 1000),
}

if (!Number.isInteger(env.port) || env.port < 1 || env.port > 65535) {
  throw new Error('PORTの設定が正しくありません。')
}

if (!env.ollamaModel) {
  throw new Error('OLLAMA_MODELをbackend/.envに設定してください。')
}

if (
  !Number.isInteger(env.comfyUiTimeoutMs) ||
  env.comfyUiTimeoutMs < 60_000 ||
  env.comfyUiTimeoutMs > 60 * 60 * 1000
) {
  throw new Error(
    'COMFYUI_TIMEOUT_MSは60000〜3600000の整数で設定してください。',
  )
}