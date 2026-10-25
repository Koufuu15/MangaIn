import { Router } from 'express'
import { z } from 'zod'
import {
  generateMangaImages,
  generateWordMangaImage,
} from '../services/mangaImageGenerator.js'

const router = Router()

const RequestSchema = z.object({
  markdown: z.string().min(1).max(100_000),
  analysis: z.string().min(1).max(100_000),
}).strict()

const WordRequestSchema = z.object({
  word: z.string().trim().min(1).max(100),
  meaning: z.string().trim().min(1).max(1_200),
}).strict()

router.post('/generate-word', async (req, res) => {
  const parsed = WordRequestSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: 'INVALID_WORD_MANGA_REQUEST',
        message: '単語とその意味を入力してください。',
      },
    })
  }

  try {
    const image = await generateWordMangaImage(parsed.data)
    return res.status(200).json({ image })
  } catch (error) {
    console.error('Word manga image generation failed:', error)
    return res.status(502).json({
      error: {
        code: 'WORD_MANGA_GENERATION_FAILED',
        message:
          '解説漫画を生成できませんでした。Cloudflare Workers AIのアカウントID・APIトークン・モデル設定を確認してください。',
      },
    })
  }
})

router.post('/generate', async (req, res) => {
  const parsed = RequestSchema.safeParse(req.body)

  if (!parsed.success || !parsed.data?.markdown.trim()) {
    return res.status(400).json({
      error: {
        code: 'INVALID_MANGA_IMAGE_REQUEST',
        message: '画像を生成するMarkdown記事と解析結果を入力してください。',
      },
    })
  }

  try {
    const images = await generateMangaImages(parsed.data)
    return res.status(200).json({ images })
  } catch (error) {
    console.error('Manga image generation failed:', error)
    return res.status(502).json({
      error: {
        code: 'MANGA_IMAGE_GENERATION_FAILED',
        message:
          '漫画画像を生成できませんでした。Cloudflare Workers AIのアカウントID・APIトークン・モデル設定を確認してください。',
      },
    })
  }
})

export default router
