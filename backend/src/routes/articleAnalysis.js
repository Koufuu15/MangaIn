import { Router } from 'express'
import { z } from 'zod'
import {
  analyzeArticle,
  generateArticleExplanation,
} from '../services/articleAnalysisService.js'

const router = Router()

const RequestSchema = z.object({
  markdown: z.string().min(1).max(100_000),
}).strict()

router.post('/analyze', async (req, res) => {
  const parsed = RequestSchema.safeParse(req.body)

  if (!parsed.success || !parsed.data?.markdown.trim()) {
    return res.status(400).json({
      error: {
        code: 'INVALID_MARKDOWN',
        message: '解析するMarkdown記事を入力してください。',
      },
    })
  }

  try {
    const result = await analyzeArticle(parsed.data.markdown)
    return res.status(200).json(result)
  } catch (error) {
    console.error('Article analysis failed:', error)

    if (
      error instanceof Error &&
      error.message.startsWith('AI_OUTPUT_')
    ) {
      return res.status(502).json({
        error: {
          code: 'INVALID_AI_OUTPUT',
          message: 'AIの解析結果を正しく読み取れませんでした。',
        },
      })
    }

    if (error instanceof z.ZodError) {
      return res.status(502).json({
        error: {
          code: 'INVALID_AI_OUTPUT',
          message: 'AIの解析結果が期待する形式と一致しません。',
        },
      })
    }

    return res.status(502).json({
      error: {
        code: 'AI_SERVICE_ERROR',
        message:
          'Ollamaへの接続またはAI解析に失敗しました。Ollamaの起動状態とモデル設定を確認してください。',
      },
    })
  }
})

router.post('/explanation', async (req, res) => {
  const parsed = RequestSchema.safeParse(req.body)

  if (!parsed.success || !parsed.data?.markdown.trim()) {
    return res.status(400).json({
      error: {
        code: 'INVALID_MARKDOWN',
        message: '解説するMarkdown記事を入力してください。',
      },
    })
  }

  try {
    const explanation = await generateArticleExplanation(parsed.data.markdown)
    return res.status(200).json({ explanation })
  } catch (error) {
    console.error('Article explanation generation failed:', error)
    return res.status(502).json({
      error: {
        code: 'ARTICLE_EXPLANATION_FAILED',
        message:
          '記事の補足解説を生成できませんでした。Ollamaの起動状態とモデル設定を確認してください。',
      },
    })
  }
})

export default router