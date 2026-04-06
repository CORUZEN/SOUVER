import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fetchSankhyaDataDictionary } from '../src/lib/integrations/sankhya-data-dictionary'

async function main() {
  const payload = await fetchSankhyaDataDictionary()
  const targetDir = join(process.cwd(), 'src', 'generated')
  const targetFile = join(targetDir, 'sankhya-data-dictionary.json')

  await mkdir(targetDir, { recursive: true })
  await writeFile(targetFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

  console.log(`Dicionário Sankhya sincronizado com sucesso em: ${targetFile}`)
  console.log(`Total de tabelas: ${payload.tableCount}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
