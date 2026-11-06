export type TextColor = "azul" | "amarelo" | "verde" | "vermelho"
export interface TextPart {
  text: string
  bold?: boolean
  italic?: boolean
  highlight?: boolean
  color?: TextColor
}

// A deliberately small text notation. HTML is never interpreted or injected.
export function parseFormattedText(
  text: string,
  inherited: Omit<TextPart, "text"> = {},
  depth = 0,
): TextPart[] {
  if (depth > 8) return [{ text, ...inherited }]
  const parts: TextPart[] = []
  let literal = ""
  const flush = () => {
    if (literal) parts.push({ text: literal, ...inherited })
    literal = ""
  }
  for (let i = 0; i < text.length; ) {
    if (text[i] === "\\" && i + 1 < text.length) {
      literal += text[i + 1]
      i += 2
      continue
    }
    const marker = text.startsWith("**", i)
      ? "**"
      : text.startsWith("==", i)
        ? "=="
        : text[i] === "*"
          ? "*"
          : null
    if (marker) {
      const end = text.indexOf(marker, i + marker.length)
      if (end > i + marker.length) {
        flush()
        const style =
          marker === "**"
            ? { bold: true }
            : marker === "*"
              ? { italic: true }
              : { highlight: true }
        parts.push(
          ...parseFormattedText(
            text.slice(i + marker.length, end),
            { ...inherited, ...style },
            depth + 1,
          ),
        )
        i = end + marker.length
        continue
      }
    }
    if (text[i] === "[") {
      const end = text.indexOf("]{", i + 1)
      if (end > i + 1) {
        const close = text.indexOf("}", end + 2)
        const color = text.slice(end + 2, close)
        if (
          close !== -1 &&
          ["azul", "amarelo", "verde", "vermelho"].includes(color)
        ) {
          flush()
          parts.push(
            ...parseFormattedText(
              text.slice(i + 1, end),
              { ...inherited, color: color as TextColor },
              depth + 1,
            ),
          )
          i = close + 1
          continue
        }
      }
    }
    literal += text[i++]
  }
  flush()
  return parts
}
export function plainText(text: string): string {
  return parseFormattedText(text)
    .map((part) => part.text)
    .join("")
}
