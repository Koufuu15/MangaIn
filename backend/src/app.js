import express from 'express'
import articleAnalysisRouter from './routes/articleAnalysis.js'
import mangaImageGenerateRouter from './routes/mangaImageGenerate.js'
import wordRouter from './routes/words.js'

const app = express()

app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/articles', articleAnalysisRouter)
app.use('/api/articles/manga-images', mangaImageGenerateRouter)
app.use('/api/words', wordRouter)

export default app