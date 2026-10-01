import { query } from '../pool.js'

export interface TemplateRow {
  id: string
  name: string
  language: string
  category: string
  status: string
  header_type: string
  header: string | null
  body: string
  footer: string | null
  buttons: string[]
}

export interface TemplateDto {
  id: string
  name: string
  language: string
  category: string
  status: string
  headerType: string
  header: string | null
  body: string
  footer: string | null
  buttons: string[]
  /** How many {{n}} placeholders the body has — the picker renders one input each. */
  variableCount: number
}

export function countVariables(body: string): number {
  let max = 0
  for (const m of body.matchAll(/\{\{(\d+)\}\}/g)) max = Math.max(max, Number(m[1]))
  return max
}

/** Substitutes {{1}}..{{n}}; throws on a missing value rather than sending a literal "{{2}}" to a customer. */
export function renderTemplateBody(body: string, variables: string[]): string {
  return body.replace(/\{\{(\d+)\}\}/g, (_, n: string) => {
    const v = variables[Number(n) - 1]
    if (v === undefined || v.trim() === '') throw new Error(`missing variable {{${n}}}`)
    return v
  })
}

export function toTemplateDto(t: TemplateRow): TemplateDto {
  return {
    id: t.id, name: t.name, language: t.language, category: t.category, status: t.status,
    headerType: t.header_type, header: t.header, body: t.body, footer: t.footer, buttons: t.buttons,
    variableCount: countVariables(t.body),
  }
}

export const templateRepository = {
  async listApproved(): Promise<TemplateRow[]> {
    return query<TemplateRow>(`SELECT * FROM wa_templates WHERE status = 'APPROVED' ORDER BY name`)
  },
  async findById(id: string): Promise<TemplateRow | null> {
    const rows = await query<TemplateRow>(`SELECT * FROM wa_templates WHERE id = $1`, [id])
    return rows[0] ?? null
  },
}
