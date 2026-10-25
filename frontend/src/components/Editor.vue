<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { basicSetup, EditorView } from 'codemirror'
import { markdown } from '@codemirror/lang-markdown'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import {
  analyzeMarkdown,
  explainWord,
  generateMangaImages,
} from '../services/articleAnalysis'

const isAnalyzing = ref(false)
const analysisResult = ref(null)
const analysisError = ref('')
const mangaImages = ref([])
const processingStage = ref('')
const previewScrollElement = ref(null)
const previewArticleElement = ref(null)
const wordPopover = ref(null)
const unknownWords = ref([])
const dictionaryError = ref('')
let explanationRequestId = 0
let explanationController
const unknownWordsStorageKey = 'mangain.unknownWords'

function loadUnknownWords() {
  try {
    const savedWords = JSON.parse(
      window.localStorage.getItem(unknownWordsStorageKey) ?? '[]',
    )
    unknownWords.value = Array.isArray(savedWords)
      ? savedWords.filter(
          (entry) =>
            typeof entry?.word === 'string' &&
            typeof entry?.meaning === 'string',
        )
      : []
  } catch (error) {
    console.error('Failed to load My dictionary:', error)
    dictionaryError.value = 'My辞書を読み込めませんでした。'
  }
}

function hideWordPopover() {
  explanationRequestId += 1
  explanationController?.abort()
  explanationController = undefined
  wordPopover.value = null
}

function selectedPreviewWord() {
  const selection = window.getSelection()
  const selectedText = selection?.toString().trim()
  const range = selection?.rangeCount ? selection.getRangeAt(0) : null

  if (
    !selectedText ||
    selectedText.length > 100 ||
    /\s/.test(selectedText) ||
    !range ||
    !previewArticleElement.value?.contains(range.commonAncestorContainer)
  ) {
    return null
  }

  return { word: selectedText, rect: range.getBoundingClientRect() }
}

async function handlePreviewMouseUp() {
  const selected = selectedPreviewWord()
  if (!selected) {
    hideWordPopover()
    return
  }

  if (
    wordPopover.value?.word === selected.word &&
    (wordPopover.value.loading || wordPopover.value.meaning)
  ) {
    return
  }

  hideWordPopover()
  const requestId = explanationRequestId
  const controller = new AbortController()
  explanationController = controller
  const scrollElement = previewScrollElement.value
  const scrollRect = scrollElement.getBoundingClientRect()
  const popoverWidth = Math.max(0, Math.min(300, scrollElement.clientWidth - 24))
  const left = Math.max(
    12,
    Math.min(
      selected.rect.left - scrollRect.left + scrollElement.scrollLeft,
      scrollElement.scrollLeft + scrollElement.clientWidth - popoverWidth - 12,
    ),
  )

  wordPopover.value = {
    word: selected.word,
    meaning: '',
    loading: true,
    error: '',
    top: selected.rect.bottom - scrollRect.top + scrollElement.scrollTop + 8,
    left,
    width: popoverWidth,
  }

  try {
    const meaning = await explainWord(selected.word, {
      signal: controller.signal,
    })
    if (requestId !== explanationRequestId) return
    wordPopover.value = { ...wordPopover.value, meaning, loading: false }
  } catch (error) {
    if (controller.signal.aborted || requestId !== explanationRequestId) return
    wordPopover.value = {
      ...wordPopover.value,
      loading: false,
      error:
        error instanceof Error
          ? error.message
          : '単語の解説に失敗しました。',
    }
  }
}

function handleSelectionChange() {
  if (!selectedPreviewWord()) hideWordPopover()
}

function handleDocumentPointerDown(event) {
  if (
    !previewScrollElement.value?.contains(event.target) ||
    !(event.target instanceof Element) ||
    !event.target.closest('.word-popover')
  ) {
    hideWordPopover()
  }
}

function addWordToDictionary() {
  if (!wordPopover.value?.meaning || wordPopover.value.error) return

  const alreadySaved = unknownWords.value.some(
    (entry) => entry.word === wordPopover.value.word,
  )
  if (alreadySaved) return

  const updatedWords = [
    {
      word: wordPopover.value.word,
      meaning: wordPopover.value.meaning,
    },
    ...unknownWords.value,
  ]

  try {
    window.localStorage.setItem(
      unknownWordsStorageKey,
      JSON.stringify(updatedWords),
    )
    unknownWords.value = updatedWords
    dictionaryError.value = ''
  } catch (error) {
    console.error('Failed to save My dictionary:', error)
    dictionaryError.value = 'My辞書に保存できませんでした。'
  }
}

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
  loadUnknownWords()
  document.addEventListener('selectionchange', handleSelectionChange)
  document.addEventListener('pointerdown', handleDocumentPointerDown)
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

onBeforeUnmount(() => {
  document.removeEventListener('selectionchange', handleSelectionChange)
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  hideWordPopover()
  editorView?.destroy()
})


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
        <div
          ref="previewScrollElement"
          class="preview-scroll"
          @mouseup="handlePreviewMouseUp"
        >
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
          <article
            ref="previewArticleElement"
            class="markdown-body"
            v-html="previewHtml"
          ></article>
          <aside
            v-if="wordPopover"
            class="word-popover"
            :style="{
              top: `${wordPopover.top}px`,
              left: `${wordPopover.left}px`,
              width: `${wordPopover.width}px`,
            }"
            aria-live="polite"
          >
            <strong class="word-popover-title">{{ wordPopover.word }}</strong>
            <p v-if="wordPopover.loading" class="word-popover-message">
              AIが解説を作成中...
            </p>
            <p v-else-if="wordPopover.error" class="word-popover-message word-popover-error">
              {{ wordPopover.error }}
            </p>
            <p v-else class="word-popover-message">{{ wordPopover.meaning }}</p>
            <button
              type="button"
              class="dictionary-add-button"
              :disabled="
                wordPopover.loading ||
                !!wordPopover.error ||
                unknownWords.some((entry) => entry.word === wordPopover.word)
              "
              @mousedown.prevent
              @click="addWordToDictionary"
            >
              {{
                unknownWords.some((entry) => entry.word === wordPopover.word)
                  ? 'My辞書に追加済み'
                  : 'My辞書に追加'
              }}
            </button>
          </aside>
        </div>
        <footer class="pane-footer">
          <span>プレビュー</span>
          <span>HTML</span>
        </footer>
      </section>
    </section>
    <section class="dictionary-section" aria-labelledby="dictionary-title">
      <div class="dictionary-heading">
        <div>
          <span class="pane-kicker">MY WORDS</span>
          <h2 id="dictionary-title">分からない単語</h2>
        </div>
        <span class="dictionary-count">{{ unknownWords.length }} 語</span>
      </div>
      <p v-if="dictionaryError" class="dictionary-error" role="alert">
        {{ dictionaryError }}
      </p>
      <p v-else-if="!unknownWords.length" class="dictionary-empty">
        プレビューで単語を選択し、My辞書に追加できます。
      </p>
      <ul v-else class="dictionary-list">
        <li v-for="entry in unknownWords" :key="entry.word">
          <strong>{{ entry.word }}</strong>
          <span>{{ entry.meaning }}</span>
        </li>
      </ul>
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
.preview-scroll {
  position: relative;
}

.word-popover {
  position: absolute;
  z-index: 2;
  padding: 13px;
  border: 1px solid #d9e5dc;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(32, 51, 40, 0.16);
}

.word-popover::before {
  position: absolute;
  top: -6px;
  left: 18px;
  width: 10px;
  height: 10px;
  border-top: 1px solid #d9e5dc;
  border-left: 1px solid #d9e5dc;
  background: #fff;
  content: '';
  transform: rotate(45deg);
}

.word-popover-title {
  display: block;
  color: #263b2e;
  font-size: 13px;
}

.word-popover-message {
  margin: 7px 0 11px;
  color: #4c5750;
  font-size: 12px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.word-popover-error,
.dictionary-error {
  color: #a33a32;
}

.dictionary-add-button {
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid #cbdacf;
  border-radius: 5px;
  background: #f3f8f4;
  color: #286b52;
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
}

.dictionary-add-button:disabled {
  cursor: default;
  opacity: 0.6;
}

.dictionary-section {
  margin-top: 20px;
  padding: 20px 22px;
  border: 1px solid #e1e6e1;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 8px 32px rgba(32, 51, 40, 0.045);
}

.dictionary-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dictionary-heading h2 {
  margin: 3px 0 0;
  color: #202724;
  font-size: 15px;
  font-weight: 600;
}

.dictionary-count,
.dictionary-empty {
  color: #7b8580;
  font-size: 12px;
}

.dictionary-list {
  display: grid;
  gap: 10px;
  margin: 16px 0 0;
  padding: 0;
  list-style: none;
}

.dictionary-list li {
  display: grid;
  grid-template-columns: minmax(100px, 0.3fr) minmax(0, 1fr);
  gap: 14px;
  padding-top: 10px;
  border-top: 1px solid #edf0ed;
  color: #4c5750;
  font-size: 12px;
  line-height: 1.6;
}

.dictionary-list strong {
  color: #263b2e;
}

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