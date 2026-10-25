export async function analyzeMarkdown(markdown) {
  const response = await fetch('/api/articles/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ markdown }),
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      data?.error?.message ??
      `AI解析に失敗しました（HTTP ${response.status}）`,
    )
  }

  return data
}

export async function explainWord(word, { signal } = {}) {
  const response = await fetch('/api/words/explain', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ word }),
    signal,
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      data?.error?.message ??
      `単語の解説に失敗しました（HTTP ${response.status}）`,
    )
  }

  return data.meaning
}

export async function generateMangaImages({ markdown, analysis }) {
  const response = await fetch('/api/articles/manga-images/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ markdown, analysis }),
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      data?.error?.message ??
      `漫画画像の生成に失敗しました（HTTP ${response.status}）`,
    )
  }

  return data.images
}

export async function generateMangaScripts({
  markdown,
  analysis,
  panelCountA = 4,
  panelCountB = 4,
  storySetting = '',
}) {
  const response = await fetch('/api/articles/manga-scripts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      markdown,
      analysis,
      panelCountA,
      panelCountB,
      storySetting,
    }),
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      data?.error?.message ??
      `マンガ脚本の生成に失敗しました（HTTP ${response.status}）`,
    )
  }

  return data
}