import { parseFormattedText, type TextPart } from "./formatted-text"

export const categories = [
  ["politica", "Política"],
  ["economia", "Economia"],
  ["esportes", "Esportes"],
  ["saude", "Saúde"],
  ["educacao", "Educação"],
  ["seguranca", "Segurança"],
  ["cultura", "Cultura"],
  ["tecnologia", "Tecnologia"],
  ["previsao-do-tempo", "Previsão do tempo"],
  ["outros", "Outros"],
] as const
export const blockTypes = [
  ["fala", "Fala"],
  ["vinheta", "Vinheta"],
  ["pausa", "Pausa"],
  ["orientacao", "Orientação"],
] as const
export type BlockType = typeof blockTypes[number][0]
export interface ScriptBlock {
  readonly ordem: number
  readonly texto: string
  readonly tipo: BlockType
}
export interface ScriptDraft {
  readonly title: string
  readonly category: string
  readonly blocks: ReadonlyArray<ScriptBlock>
}
export interface Script extends ScriptDraft {
  readonly id: string
  readonly content: string
  readonly status: string
  readonly createdAt: string
  readonly updatedAt: string
}
export interface ScriptWord {
  readonly text: string
  readonly index: number
  readonly parts: ReadonlyArray<TextPart>
}

export function createReaderScript(content: string) {
  let wordOffset = 0
  const lines: Array<ReadonlyArray<ScriptWord>> = []
  let words: ScriptWord[] = []
  let parts: TextPart[] = []
  const flushWord = () => {
    if (parts.length) words.push({ text: parts.map(part => part.text).join(""), index: wordOffset++, parts })
    parts = []
  }
  const flushLine = () => {
    flushWord()
    if (words.length) lines.push(words)
    words = []
  }
  // Parse before splitting lines so a formatted selection can span paragraphs.
  for (const part of parseFormattedText(content)) {
    for (const token of part.text.split(/(\r\n|[\r\n]|[^\S\r\n]+)/)) {
      if (/[\r\n]/.test(token)) flushLine()
      else if (/\s/.test(token)) flushWord()
      else if (token) parts.push({ ...part, text: token })
    }
  }
  flushLine()
  return { lines, totalWords: wordOffset }
}

export function fromApiScript(value: unknown): Script {
  if (!value || typeof value !== "object")
    throw new Error("Roteiro inválido recebido do servidor.")
  const v = value as Record<string, unknown>
  if (
    typeof v["_id"] !== "string" ||
    !/^[a-f\d]{24}$/i.test(v["_id"]) ||
    typeof v["titulo"] !== "string" ||
    typeof v["categoria"] !== "string" ||
    !Array.isArray(v["blocos"]) ||
    !v["blocos"].length ||
    typeof v["createdAt"] !== "string" ||
    !Number.isFinite(Date.parse(v["createdAt"])) ||
    typeof v["updatedAt"] !== "string" ||
    !Number.isFinite(Date.parse(v["updatedAt"]))
  )
    throw new Error("O roteiro recebido do servidor está incompleto.")
  const blocks: ScriptBlock[] = v["blocos"]
    .map((block: unknown) => {
      if (!block || typeof block !== "object")
        throw new Error("Bloco inválido.")
      const b = block as Record<string, unknown>
      if (
        typeof b["texto"] !== "string" ||
        !Number.isFinite(b["ordem"]) ||
        typeof b["tipo"] !== "string" ||
        !blockTypes.some(([type]) => type === b["tipo"])
      )
        throw new Error("Bloco inválido recebido do servidor.")
      return {
        ordem: Number(b["ordem"]),
        texto: b["texto"],
        tipo: b["tipo"] as BlockType,
      }
    })
    .sort((a, b) => a.ordem - b.ordem)
  return {
    id: v["_id"],
    title: v["titulo"],
    category: v["categoria"],
    blocks,
    content: blocks
      .filter((b) => b.tipo === "fala")
      .map((b) => b.texto)
      .join("\n\n"),
    status: typeof v["status"] === "string" ? v["status"] : "rascunho",
    createdAt: v["createdAt"],
    updatedAt: v["updatedAt"],
  }
}
export function toApiDraft(draft: ScriptDraft) {
  const title = draft.title.trim()
  if (title.length < 3 || title.length > 160)
    throw new Error("O título deve ter entre 3 e 160 caracteres.")
  if (!categories.some(([key]) => key === draft.category))
    throw new Error("Selecione uma categoria.")
  if (!draft.blocks.length) throw new Error("Adicione pelo menos um bloco.")
  const blocks = draft.blocks.map((b, i) => {
    if (
      !b.texto.trim() ||
      b.texto.length > 5000 ||
      !blockTypes.some(([type]) => type === b.tipo)
    )
      throw new Error(
        `Confira o texto e o tipo do bloco ${i + 1}. O limite é de 5.000 caracteres.`,
      )
    return { ordem: i + 1, texto: b.texto.trim(), tipo: b.tipo }
  })
  return { titulo: title, categoria: draft.category, blocos: blocks }
}
