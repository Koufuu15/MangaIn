import { Router } from 'express'
import { z } from 'zod'

import { analyzeArticle } from '../services/articleAnalysisService.js'

const router = Router()

const RequestSchema = z.object({
  markdown: z.string().min(1).max(100_000),
}).strict()

router.post('/analyze', async (req, res) => {
  const parsed = RequestSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'Markdown記事を入力してください。',
      },
    })
  }

  if (!parsed.data.markdown.trim()) {
    return res.status(400).json({
      error: {
        code: 'EMPTY_MARKDOWN',
        message: '解析する記事が空です。',
      },
    })
  }

  try {
    const result = await analyzeArticle(
      parsed.data.markdown,
    )

    return res.status(200).json(result)
  } catch (error) {
    console.error('Article analysis failed:', error)

    if (
      error instanceof Error &&
      error.message === 'AI_OUTPUT_UNAVAILABLE'
    ) {
      return res.status(502).json({
        error: {
          code: 'INVALID_AI_OUTPUT',
          message: 'AIの解析結果を取得できませんでした。',
        },
      })
    }

    return res.status(502).json({
      error: {
        code: 'AI_SERVICE_ERROR',
        message: 'AI解析に失敗しました。時間をおいて再試行してください。',
      },
    })
  }
})

export default router