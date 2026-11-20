// 从 src/utils/iconCatalog.ts 生成 src/components/icons/registry.ts
// 改了图标目录后运行：npm run gen:icons
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const src = fs.readFileSync(path.join(root, 'src/utils/iconCatalog.ts'), 'utf8')
const names = [...src.matchAll(/^\s*e\('([a-z0-9-]+)'/gm)].map((m) => m[1])

for (const n of names) {
  const f = path.join(root, 'node_modules/lucide-react-native/dist/types/icons', `${n}.d.ts`)
  if (!fs.existsSync(f)) throw new Error(`lucide-react-native 里没有图标：${n}`)
}

const pascal = (n) => n.split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join('') + 'Icon'
const lines = [
  `// 由 scripts/gen-icons.js 根据 iconCatalog.ts 生成，不要手改。`,
  `// 每个图标单独 import，只打包用到的 ${names.length} 个；Record<IconName, ...> 保证和目录一一对应。`,
  `import type { LucideIcon } from 'lucide-react-native'`,
  ...names.map((n) => `import ${pascal(n)} from 'lucide-react-native/icons/${n}'`),
  `import type { IconName } from '../../utils/iconCatalog'`,
  ``,
  `export const ICON_REGISTRY: Record<IconName, LucideIcon> = {`,
  ...names.map((n) => `  '${n}': ${pascal(n)},`),
  `}`,
  ``,
]
fs.mkdirSync(path.join(root, 'src/components/icons'), { recursive: true })
fs.writeFileSync(path.join(root, 'src/components/icons/registry.ts'), lines.join('\n'))
console.log(`registry: ${names.length} icons`)
