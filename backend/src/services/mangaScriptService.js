import { Ollama } from 'ollama'
import { z } from 'zod'
import { env } from '../config/env.js'

const ollama = new Ollama({ host: env.ollamaHost })
const MAX_RETRIES = 2

const PanelSchema = z.object({
  panelNumber: z.number().int().positive(),
  scene: z.string().min(1),
  characters: z.array(z.string()),
  composition: z.string().min(1),
  expression: z.string().min(1),
  dialogue: z.array(z.string()),
  visualDescription: z.string().min(1),
}).strict()

const MangaSchema = z.object({
  title: z.string().min(1),
  premise: z.string().min(1),
  panels: z.array(PanelSchema).min(1),
}).strict()

export const MangaScriptsSchema = z.object({
  sharedCharacterSettings: z.array(z.object({
    characterId: z.string().min(1),
    name: z.string().min(1),
    appearance: z.string().min(1),
    personality: z.string().min(1),
  }).strict()).min(1),
  sharedArtStyle: z.string().min(1),
  mangaA: MangaSchema,
  mangaB: MangaSchema,
}).strict().superRefine((value, ctx) => {
  for (const key of ['mangaA', 'mangaB']) {
    value[key].panels.forEach((panel, index) => {
      if (panel.panelNumber !== index + 1) {
        ctx.addIssue({ code: 'custom', path: [key, 'panels', index, 'panelNumber'], message: 'コマ番号は1から順番にしてください。' })
      }
    })
    const expected = key === 'mangaA' ? value.mangaA.panels.length : value.mangaB.panels.length
    for (const [index, panel] of value[key].panels.entries()) {
      for (const id of panel.characters) {
        if (!value.sharedCharacterSettings.some((character) => character.characterId === id)) {
          ctx.addIssue({ code: 'custom', path: [key, 'panels', index, 'characters'], message: `未定義のキャラクターID: ${id}` })
        }
      }
    }
    if (expected < 1) ctx.addIssue({ code: 'custom', path: [key, 'panels'], message: '最低1コマ必要です。' })
  }
})

const panelJsonSchema = {
  type: 'object',
  properties: {
    panelNumber: { type: 'integer' },
    scene: { type: 'string' },
    characters: { type: 'array', items: { type: 'string' } },
    composition: { type: 'string' },
    expression: { type: 'string' },
    dialogue: { type: 'array', items: { type: 'string' } },
    visualDescription: { type: 'string' },
  },
  required: ['panelNumber', 'scene', 'characters', 'composition', 'expression', 'dialogue', 'visualDescription'],
  additionalProperties: false,
}
const mangaJsonSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    premise: { type: 'string' },
    panels: { type: 'array', items: panelJsonSchema },
  },
  required: ['title', 'premise', 'panels'],
  additionalProperties: false,
}
const outputJsonSchema = {
  type: 'object',
  properties: {
    sharedCharacterSettings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          characterId: { type: 'string' }, name: { type: 'string' },
          appearance: { type: 'string' }, personality: { type: 'string' },
        },
        required: ['characterId', 'name', 'appearance', 'personality'],
        additionalProperties: false,
      },
    },
    sharedArtStyle: { type: 'string' },
    mangaA: mangaJsonSchema,
    mangaB: mangaJsonSchema,
  },
  required: ['sharedCharacterSettings', 'sharedArtStyle', 'mangaA', 'mangaB'],
  additionalProperties: false,
}

function decodeJsonString(token) {
  try { return JSON.parse(`"${token}"`) } catch { return token.replace(/\\n/g, '\n').replace(/\\"/g, '"') }
}

function extractStringField(raw, key) {
  const match = raw.match(new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`))
  return match ? decodeJsonString(match[1]).trim() : ''
}

function extractStringArray(raw, key) {
  const keyMatch = raw.match(new RegExp(`"${key}"\\s*:\\s*\\[`))
  if (!keyMatch) return []
  const rest = raw.slice(keyMatch.index + keyMatch[0].length)
  const end = rest.indexOf(']')
  const segment = end >= 0 ? rest.slice(0, end) : rest
  const values = []
  const stringPattern = /"((?:\\.|[^"\\])*)"/g
  let match
  while ((match = stringPattern.exec(segment)) !== null) {
    const value = decodeJsonString(match[1]).trim()
    if (value) values.push(value)
  }
  return values
}

/**
 * Accepts either a parsed object or a truncated/malformed JSON string from the previous AI step.
 * Recovers independently readable fields instead of rejecting the entire payload.
 */
export function recoverArticleAnalysis(input) {
  let source = input
  if (typeof input === 'string') {
    try {
      source = JSON.parse(input)
    } catch {
      source = {
        summary: extractStringField(input, 'summary'),
        mainTechnology: extractStringField(input, 'mainTechnology'),
        relatedTechnologies: extractStringArray(input, 'relatedTechnologies'),
        keyFacts: extractStringArray(input, 'keyFacts'),
      }
    }
  }
  if (!source || typeof source !== 'object' || Array.isArray(source)) source = {}
  const stringValue = (v) => typeof v === 'string' ? v.trim() : ''
  const stringArray = (v) => Array.isArray(v) ? v.filter((item) => typeof item === 'string').map((item) => item.trim()).filter(Boolean) : []
  return {
    summary: stringValue(source.summary),
    mainTechnology: stringValue(source.mainTechnology),
    relatedTechnologies: stringArray(source.relatedTechnologies),
    keyFacts: stringArray(source.keyFacts),
  }
}

function buildPrompt(analysis, countA, countB, storySetting) {
  return `あなたは、技術的な正確性を重視する漫画脚本家です。次の部分的な記事解析データから、漫画Aと漫画Bの脚本を作ってください。

【解析データ】
${JSON.stringify(analysis, null, 2)}

【漫画A：記事の要約漫画】
- コマ数は正確に${countA}コマ。
- 課題、技術の仕組み、解決または効果の流れを基本にする。
- 記事に書かれていない仕様や数値を事実として作らない。

【漫画B：技術を使ったストーリー漫画】
- コマ数は正確に${countB}コマ。
- 問題発生、技術を使った解決、結果の流れにする。
- ストーリー設定は架空でよいが、技術の仕組みや効果を誤って描写しない。
- 具体的な設定の希望：${storySetting || '日常生活に起きた小さな謎を、探偵役が技術の考え方を使って解決する'}

【共通ルール】
- 両方の漫画で同じキャラクター設定と画風設定を共有する。
- 各コマに場面、登場人物ID、構図、表情、セリフ、画像生成用の視覚的説明を含める。
- セリフはdialogue、画像生成用説明はvisualDescriptionに分ける。
- dialogueとvisualDescriptionは別フィールドで出力する。初期実装では画像生成AIに渡す際、必要に応じて両フィールドを組み合わせてよい。visualDescriptionには場面・人物・構図など視覚情報を中心に書き、セリフ自体はdialogueを正として扱う。
- charactersにはsharedCharacterSettingsに定義したcharacterIdのみを使う。
- panelNumberは1から連番。コマ数を増減しない。
- 出力は指定JSON Schemaに適合するJSONのみ。Markdownやコードフェンスは禁止。
- 解析データが不完全な場合は、読み取れる情報だけを利用する。不明な事実を捏造しない。

各コマのvisualDescriptionは、登場人物の外見、場所、動作、背景、光、画面内の位置が画像化できる程度に具体的に記述してください。sharedArtStyleは両方の漫画に適用できる具体的な画風説明にしてください。`
}

export async function generateMangaScripts({ analysis: rawAnalysis, panelCountA = 4, panelCountB = 4, storySetting = '' }) {
  const analysis = recoverArticleAnalysis(rawAnalysis)
  if (!analysis.summary && !analysis.mainTechnology && analysis.keyFacts.length === 0) {
    const error = new Error('ARTICLE_ANALYSIS_EMPTY')
    error.code = 'ARTICLE_ANALYSIS_EMPTY'
    throw error
  }

  const countA = Number(panelCountA)
  const countB = Number(panelCountB)
  if (!Number.isInteger(countA) || countA < 1 || countA > 12 || !Number.isInteger(countB) || countB < 1 || countB > 12) {
    const error = new Error('INVALID_PANEL_COUNT')
    error.code = 'INVALID_PANEL_COUNT'
    throw error
  }

  const basePrompt = buildPrompt(analysis, countA, countB, storySetting)
  let lastError
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const retryInstruction = attempt === 0 ? '' : `\n\n前回の出力は検証に失敗しました。必ずJSON Schemaに適合させてください。検証エラー: ${lastError}`
    try {
      const response = await ollama.chat({
        model: env.ollamaModel,
        stream: false,
        format: outputJsonSchema,
        messages: [
          { role: 'system', content: 'あなたは厳密なJSON形式で漫画脚本を作成するアシスタントです。技術的な事実と架空の物語設定を混同しません。' },
          { role: 'user', content: basePrompt + retryInstruction },
        ],
        options: { temperature: 0.2, num_predict: 4096 },
      })
      const content = response?.message?.content ?? ''
      if (!content.trim()) throw new Error('AI_OUTPUT_EMPTY')
      const parsed = JSON.parse(content)
      const validated = MangaScriptsSchema.parse(parsed)
      if (validated.mangaA.panels.length !== countA || validated.mangaB.panels.length !== countB) {
        throw new Error(`PANEL_COUNT_MISMATCH: expected A=${countA}, B=${countB}; got A=${validated.mangaA.panels.length}, B=${validated.mangaB.panels.length}`)
      }
      return { ...validated, sourceAnalysis: analysis }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
      console.warn(`Manga script generation attempt ${attempt + 1} failed: ${lastError}`)
    }
  }
  const error = new Error(`MANGA_SCRIPT_GENERATION_FAILED: ${lastError}`)
  error.code = 'MANGA_SCRIPT_GENERATION_FAILED'
  throw error
}
