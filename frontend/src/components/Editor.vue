<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { basicSetup, EditorView } from 'codemirror'
import { markdown } from '@codemirror/lang-markdown'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { analyzeMarkdown, generateMangaScripts } from '../services/articleAnalysis'

const isAnalyzing = ref(false)
const analysisResult = ref(null)
const analysisError = ref('')

async function handleAnalyze() {
  if (isAnalyzing.value) return

  if (!markdownSource.value.trim()) {
    analysisError.value = 'Markdown記事を入力してください。'
    return
  }

  isAnalyzing.value = true
  analysisError.value = ''
  analysisResult.value = null
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

    // ② マンガ脚本作成
    console.log('[DEBUG] Starting manga script generation')

    const scripts = await generateMangaScripts({
      markdown: markdownSource.value,
      analysis,
      panelCountA: 4,
      panelCountB: 4,
      storySetting: '',
    })

    console.log('[DEBUG] Manga script generation completed', scripts)

    // ③ 両方の結果をデバッグ画面に表示
    rawAiResponse.value =
      '=== 記事解析結果 ===\n' +
      JSON.stringify(analysis, null, 2) +
      '\n\n=== マンガ脚本生成結果 ===\n' +
      JSON.stringify(scripts, null, 2)

  } catch (error) {
    console.error('[DEBUG] AI processing failed:', error)

    analysisError.value =
      error.message || '予期しないエラーが発生しました。'
  } finally {
    isAnalyzing.value = false
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
        {{ isAnalyzing ? 'AI解析中...' : 'AIに送信' }}
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