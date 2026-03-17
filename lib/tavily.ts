interface TavilyResult {
  title?: string
  url?: string
  content?: string
}

interface TavilyResponse {
  results?: TavilyResult[]
}

export async function searchWeb(query: string) {
  if (!process.env.TAVILY_API_KEY || !query.trim()) {
    return ''
  }

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      max_results: 5,
      search_depth: 'advanced',
      include_answer: false,
    }),
  })

  if (!response.ok) {
    throw new Error('Web search failed')
  }

  const payload = await response.json() as TavilyResponse
  const results = payload.results ?? []

  if (results.length === 0) {
    return ''
  }

  return results
    .map((result, index) => {
      const title = result.title?.trim() || 'Untitled result'
      const url = result.url?.trim() || ''
      const content = result.content?.trim() || ''
      return `${index + 1}. ${title}\n${url}\n${content}`
    })
    .join('\n\n')
}
