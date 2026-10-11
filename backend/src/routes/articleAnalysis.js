import { Router } from 'express'
import { z } from 'zod'
import { analyzeArticle } from '../services/articleAnalysisService.js'
import { generateMangaScripts } from '../services/mangaScriptService.js'

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


const MangaScriptsRequestSchema = z.object({
  // `analysis` may be a parsed object or an incomplete JSON string from the previous AI step.
  analysis: z.union([z.string().min(1).max(100_000), z.record(z.string(), z.unknown())]),
  panelCountA: z.coerce.number().int().min(1).max(12).optional().default(4),
  panelCountB: z.coerce.number().int().min(1).max(12).optional().default(4),
  storySetting: z.string().max(2_000).optional().default(''),
}).strict()

router.post('/manga-scripts', async (req, res) => {
  const parsed = MangaScriptsRequestSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: 'INVALID_MANGA_SCRIPT_REQUEST',
        message: '解析結果とコマ数の指定を確認してください。コマ数は1〜12で指定できます。',
        details: parsed.error.issues,
      },
    })
  }

  try {
    const result = await generateMangaScripts(parsed.data)
    return res.status(200).json(result)
  } catch (error) {
    console.error('Manga script generation failed:', error)
    if (error?.code === 'ARTICLE_ANALYSIS_EMPTY') {
      return res.status(400).json({
        error: { code: 'ARTICLE_ANALYSIS_EMPTY', message: '解析結果から読み取れる記事情報がありません。' },
      })
    }
    if (error?.code === 'INVALID_PANEL_COUNT') {
      return res.status(400).json({
        error: { code: 'INVALID_PANEL_COUNT', message: 'コマ数は1〜12の整数で指定してください。' },
      })
    }
    return res.status(502).json({
      error: {
        code: 'MANGA_SCRIPT_GENERATION_FAILED',
        message: '漫画脚本を生成できませんでした。Ollamaの起動状態、モデル設定、生成ログを確認してください。',
      },
    })
  }
})

export default router