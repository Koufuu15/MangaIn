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