import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fetchSankhyaLiveCatalog } from '../src/lib/integrations/sankhya-live-catalog'

async function main() {
  const payload = await fetchSankhyaLiveCatalog()
  const targetDir = join(process.cwd(), 'src', 'generated')
  const targetFile = join(targetDir, 'sankhya-live-tables.json')

  await mkdir(targetDir, { recursive: true })
  await writeFile(targetFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

  console.log(`Catalogo live da Sankhya sincronizado em: ${targetFile}`)
  console.log(`Schema: ${payload.schemaOwner} | Tabelas: ${payload.totalTables}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
