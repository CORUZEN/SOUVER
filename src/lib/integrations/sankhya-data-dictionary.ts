const SANKHYA_DICTIONARY_URL = 'https://developer.sankhya.com.br/docs/dicion%C3%A1rio-de-dados'

export interface SankhyaDataDictionaryTable {
  code: string
  anchor: string
  url: string
  description: string
}

export interface SankhyaDataDictionaryPayload {
  sourceUrl: string
  fetchedAt: string
  tableCount: number
  tables: SankhyaDataDictionaryTable[]
}

function decodeHtml(input: string): string {
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&aacute;/gi, 'á')
    .replace(/&eacute;/gi, 'é')
    .replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó')
    .replace(/&uacute;/gi, 'ú')
    .replace(/&ccedil;/gi, 'ç')
    .replace(/&atilde;/gi, 'ã')
    .replace(/&otilde;/gi, 'õ')
}

function repairMojibake(input: string): string {
  if (!/[ÃÂ]/.test(input)) return input
  try {
    return Buffer.from(input, 'latin1').toString('utf8')
  } catch {
    return input
  }
}

function stripTags(input: string): string {
  return input.replace(/<[^>]+>/g, ' ')
}

function normalizeText(input: string): string {
  return repairMojibake(decodeHtml(stripTags(input))).replace(/\s+/g, ' ').trim()
}

function parseTablesFromHtml(html: string): SankhyaDataDictionaryTable[] {
  const sectionRegex =
    /<h2[^>]*>\s*<div class="heading-anchor anchor waypoint" id="([^"]+)"><\/div>\s*<div class="heading-text">([^<]+)<\/div>[\s\S]*?<\/h2>\s*<p>([\s\S]*?)<\/p>/gim

  const tables: SankhyaDataDictionaryTable[] = []
  let match: RegExpExecArray | null = sectionRegex.exec(html)

  while (match) {
    const anchor = normalizeText(match[1])
    const code = normalizeText(match[2]).toUpperCase()
    const description = normalizeText(match[3])

    if (/^(TDD|TRD)/.test(code) && description) {
      tables.push({
        code,
        anchor,
        url: `${SANKHYA_DICTIONARY_URL}#${anchor}`,
        description,
      })
    }

    match = sectionRegex.exec(html)
  }

  return tables
}

export async function fetchSankhyaDataDictionary(): Promise<SankhyaDataDictionaryPayload> {
  const response = await fetch(SANKHYA_DICTIONARY_URL, {
    headers: {
      'User-Agent': 'SOUVER-Sankhya-Dictionary-Collector/1.0',
      Accept: 'text/html,application/xhtml+xml',
    },
    next: { revalidate: 86_400 },
  })

  if (!response.ok) {
    throw new Error(`Falha ao consultar o dicionário Sankhya: HTTP ${response.status}.`)
  }

  const html = await response.text()
  const tables = parseTablesFromHtml(html).sort((a, b) => a.code.localeCompare(b.code))

  if (tables.length === 0) {
    throw new Error('Não foi possível extrair tabelas do dicionário Sankhya.')
  }

  return {
    sourceUrl: SANKHYA_DICTIONARY_URL,
    fetchedAt: new Date().toISOString(),
    tableCount: tables.length,
    tables,
  }
}
