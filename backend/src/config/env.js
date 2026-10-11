import 'dotenv/config'

export const env = {
  port: Number(process.env.PORT || 3000),
  ollamaHost:
    process.env.OLLAMA_HOST || 'http://127.0.0.1:11434',
  ollamaModel: process.env.OLLAMA_MODEL?.trim(),
}

if (!Number.isInteger(env.port) || env.port < 1 || env.port > 65535) {
  throw new Error('PORTの設定が正しくありません。')
}

if (!env.ollamaModel) {
  throw new Error('OLLAMA_MODELをbackend/.envに設定してください。')
}