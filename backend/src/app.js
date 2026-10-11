import express from 'express'
import articleAnalysisRouter from './routes/articleAnalysis.js'

const app = express()

app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/articles', articleAnalysisRouter)

export default app