import app from './app.js'
import { env } from './config/env.js'

app.listen(env.port, () => {
  console.log(`Backend listening on http://localhost:${env.port}`)
  console.log(`Ollama host: ${env.ollamaHost}`)
  console.log(`Ollama model: ${env.ollamaModel}`)
})