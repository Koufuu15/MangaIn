import 'dotenv/config'

function requiredEnv(name) {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}`,
    )
  }

  return value
}

export const env = {
  openaiApiKey: requiredEnv('OPENAI_API_KEY'),
  openaiModel: requiredEnv('OPENAI_MODEL'),
}