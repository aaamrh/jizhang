import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { buildXlsx, colName } from './xlsx'

describe('导出 Excel', () => {
  it('列号转字母', () => {
    expect([0, 25, 26, 27, 701].map(colName)).toEqual(['A', 'Z', 'AA', 'AB', 'ZZ'])
  })
  it('生成标准的 xlsx 结构；中文、特殊字符转义；数字保留为数字', () => {
    const files = unzipSync(buildXlsx('账目', [['日期', '金额', '备注'], ['2026-11-18', 32.5, '火锅 & <啤酒>'], ['2026-11-17', 3, null]], [12, 10, 20]))
    expect(Object.keys(files).sort()).toEqual(
      ['[Content_Types].xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml'].sort(),
    )
    const sheet = strFromU8(files['xl/worksheets/sheet1.xml']!)
    expect(sheet).toContain('<c r="B2"><v>32.5</v></c>')
    expect(sheet).toContain('火锅 &amp; &lt;啤酒&gt;')
    expect(sheet).toContain('<c r="A1" t="inlineStr" s="1">')
    expect(sheet).not.toContain('C3') // 空格子不写
    expect(strFromU8(files['xl/workbook.xml']!)).toContain('name="账目"')
  })
})
