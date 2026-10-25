<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { basicSetup, EditorView } from 'codemirror'
import { markdown } from '@codemirror/lang-markdown'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import {
  analyzeMarkdown,
  generateMangaImages,
} from '../services/articleAnalysis'

const isAnalyzing = ref(false)
const analysisResult = ref(null)
const analysisError = ref('')
const mangaImages = ref([])
const processingStage = ref('')

async function handleAnalyze() {
  if (isAnalyzing.value) return

  if (!markdownSource.value.trim()) {
    analysisError.value = 'Markdown記事を入力してください。'
    return
  }

  isAnalyzing.value = true
  processingStage.value = '記事を解析中...'
  analysisError.value = ''
  analysisResult.value = null
  mangaImages.value = []
  rawAiResponse.value = ''

  try {
    // ① 記事解析
    console.log('[DEBUG] Starting article analysis')

    const analysis = await analyzeMarkdown(
      markdownSource.value,
    )

    analysisResult.value = analysis

    rawAiResponse.value =
      '=== 記事解析結果 ===\n' +
      JSON.stringify(analysis, null, 2)

    console.log('[DEBUG] Article analysis completed', analysis)

    processingStage.value = '漫画画像を生成中...'
    mangaImages.value = await generateMangaImages({
      markdown: markdownSource.value,
      analysis,
    })

  } catch (error) {
    console.error('[DEBUG] AI processing failed:', error)

    analysisError.value =
      error.message || '予期しないエラーが発生しました。'
  } finally {
    isAnalyzing.value = false
    processingStage.value = ''
  }
}

const editorElement = ref(null)
const markdownSource = ref(`# MangaInへようこそ

ここに **Markdown** を書くと、右側にプレビューが表示されます。

## できること

- 見出しやリストの記述
- [リンク](https://example.com) や **強調** の追加
- コードや文章を自由に編集
`)

let editorView

const previewHtml = computed(() => DOMPurify.sanitize(marked.parse(markdownSource.value)))
const lineCount = computed(() => markdownSource.value.split('\n').length)
const characterCount = computed(() => markdownSource.value.length)

onMounted(() => {
  editorView = new EditorView({
    doc: markdownSource.value,
    extensions: [
      basicSetup,
      markdown(),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) markdownSource.value = update.state.doc.toString()
      }),
    ],
    parent: editorElement.value,
  })
})

onBeforeUnmount(() => editorView?.destroy())


const rawAiResponse = ref('')
</script>

<template>
  <main class="workspace">
    <header class="topbar">
      <a class="brand" href="/" aria-label="MangaIn ホーム">
        <span class="brand-mark" aria-hidden="true">M</span>
        <span>MangaIn</span>
      </a>
      <div class="topbar-meta">
        <span class="document-name">無題のドキュメント</span>
        <span class="format-label"><span class="format-dot"></span>Markdown</span>
      </div>
      <button
        class="share-button"
        type="button"
        :disabled="isAnalyzing"
        @click="handleAnalyze"
      >
        {{ isAnalyzing ? processingStage : 'AIに送信' }}
        <span aria-hidden="true">↗</span>
      </button>
    </header>

    <section class="editor-layout" aria-label="Markdownエディター">
      <section class="pane editor-pane" aria-labelledby="editor-title">
        <div class="pane-heading">
          <div>
            <span class="pane-kicker">WRITE</span>
            <h1 id="editor-title">Editor</h1>
          </div>
          <span class="pane-detail">Markdown</span>
        </div>
        <div ref="editorElement" class="code-editor" aria-label="Markdown本文"></div>
        <footer class="pane-footer">
          <span>{{ lineCount }} 行</span>
          <span>{{ characterCount }} 文字</span>
        </footer>
      </section>

      <section class="pane preview-pane" aria-labelledby="preview-title">
        <div class="pane-heading">
          <div>
            <span class="pane-kicker">OUTPUT</span>
            <h2 id="preview-title">Preview</h2>
          </div>
          <span class="preview-state"><span class="preview-dot"></span>Live</span>
        </div>
        <div class="preview-scroll">
          <section
            v-if="mangaImages.length"
            class="manga-images"
            aria-label="生成された漫画画像"
          >
            <details
              v-for="(image, index) in mangaImages"
              :key="image.title"
              class="manga-image"
            >
              <summary>漫画画像 {{ index + 1 }}：{{ image.title }}</summary>
              <img :src="image.dataUrl" :alt="`${image.title}の漫画画像`">
            </details>
          </section>
          <article class="markdown-body" v-html="previewHtml"></article>
        </div>
        <footer class="pane-footer">
          <span>プレビュー</span>
          <span>HTML</span>
        </footer>
      </section>
    </section>
    <section
  v-if="analysisError"
  class="analysis-error"
  role="alert"
>
  {{ analysisError }}
</section>
<section class="debug-panel">
    <h2>AI生成結果（デバッグ）</h2>

    <pre>{{ rawAiResponse || 'まだ結果がありません' }}</pre>
  </section>
    <div class="workspace-caption">WRITE WITH CLARITY<span>·</span>SEE IT TAKE SHAPE</div>
  </main>
</template>

<style scoped>
.debug-panel {
  margin-top: 24px;
  padding: 16px;
  border: 1px solid #ccc;
  border-radius: 8px;
}

.manga-images {
  display: grid;
  gap: 12px;
  max-width: 680px;
  margin: 0 auto 28px;
}

.manga-image {
  overflow: hidden;
  border: 1px solid #e1e6e1;
  border-radius: 6px;
  background: #fbfcfb;
}

.manga-image summary {
  padding: 12px 14px;
  color: #354039;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}

.manga-image img {
  display: block;
  width: 100%;
  border-top: 1px solid #e1e6e1;
}

.debug-panel pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: 600px;
  overflow-y: auto;
  padding: 12px;
  background: #f5f5f5;
  color: #222;
  border-radius: 4px;
}
</style>