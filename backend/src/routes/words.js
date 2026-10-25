import { Router } from 'express'
import { z } from 'zod'
import { explainWord } from '../services/wordExplanationService.js'

const router = Router()

const RequestSchema = z.object({
  word: z.string().trim().min(1).max(100),
}).strict()

router.post('/explain', async (req, res) => {
  const parsed = RequestSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: 'INVALID_WORD',
        message: '解説する単語を1〜100文字で入力してください。',
      },
    })
  }

  try {
    const meaning = await explainWord(parsed.data.word)
    return res.status(200).json({ meaning })
  } catch (error) {
    console.error('Word explanation failed:', error)
    return res.status(502).json({
      error: {
        code: 'WORD_EXPLANATION_FAILED',
        message:
          '単語を解説できませんでした。Ollamaの起動状態とモデル設定を確認してください。',
      },
    })
  }
})

export default router
