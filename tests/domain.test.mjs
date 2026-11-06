import { test } from "node:test"
import assert from "node:assert/strict"
import { pathToFileURL } from "node:url"
import { join } from "node:path"
const load = path => import(pathToFileURL(join(process.env.TEST_MODULE_ROOT, path + ".js")))
const { parseFormattedText, plainText } = await load("models/formatted-text")
const { createReaderScript, fromApiScript, toApiDraft } = await load("models/script.model")
const { alignTranscript } = await load("presentation/speech-alignment")
const protocol = await load("presentation/projection.protocol")
const record = { _id: "0123456789abcdef01234567", titulo: "Jornal da noite", categoria: "outros", status: "rascunho", createdAt: "2026-11-02T12:00:00Z", updatedAt: "2026-11-02T12:00:00Z",
  blocos: [{ ordem: 2, texto: "**Boa noite.**", tipo: "fala" }, { ordem: 1, texto: "Abrir câmera", tipo: "orientacao" }] }

test("formatting renders emphasis without changing spoken text", () => {
  assert.equal(plainText("**Boa** *noite* ==Brasil== [hoje]{azul}"), "Boa noite Brasil hoje")
  assert.ok(parseFormattedText("**Boa**")[0].bold)
  assert.ok(parseFormattedText("==Boa==")[0].highlight)
})
test("HTML and unknown formatting stay inert text", () => {
  assert.equal(plainText('<img src=x onerror=alert(1)>'), '<img src=x onerror=alert(1)>')
  assert.equal(plainText('[oi]{javascript:alert(1)}'), '[oi]{javascript:alert(1)}')
  assert.equal(plainText('**sem fechamento'), '**sem fechamento')
})
test("reader preserves partial-word formatting and paragraph indexes", () => {
  const result = createReaderScript('**Tele**jornal agora.\n\nMais notícias.')
  assert.equal(result.totalWords, 4)
  assert.equal(result.lines[0][0].text, 'Telejornal')
  assert.equal(result.lines[0][0].parts.length, 2)
  assert.equal(result.lines[1][0].index, 2)
})
test("formatting across paragraph breaks stays consistent between preview and reader", () => {
  const result = createReaderScript('**Boa noite.\r\n\r\nMais notícias.**')
  assert.equal(result.totalWords, 4)
  assert.equal(result.lines.length, 2)
  assert.deepEqual(result.lines.flat().map(word => word.text), ['Boa', 'noite.', 'Mais', 'notícias.'])
  assert.ok(result.lines.flat().every(word => word.parts.every(part => part.bold)))
})
test("API adapter orders blocks, preserves notes, reads only speech", () => {
  const script = fromApiScript(record)
  assert.equal(script.blocks[0].tipo, "orientacao")
  assert.equal(script.content, "**Boa noite.**")
  assert.equal(script.id, record._id)
})
test("outgoing payload contains only known backend fields", () => {
  assert.deepEqual(toApiDraft({ title: "  Jornal  ", category: "outros", blocks: [{ ordem: 99, texto: " Boa noite ", tipo: "fala" }] }),
    { titulo: "Jornal", categoria: "outros", blocos: [{ ordem: 1, texto: "Boa noite", tipo: "fala" }] })
})
test("invalid category, title, empty block and oversized block are rejected", () => {
  const draft = { title: "Jornal", category: "outros", blocks: [{ ordem: 1, texto: "Oi", tipo: "fala" }] }
  for (const change of [{ title: "a" }, { title: "a".repeat(161) }, { category: "inventada" }, { blocks: [] }, { blocks: [{ ordem: 1, texto: " ", tipo: "fala" }] }, { blocks: [{ ordem: 1, texto: "a".repeat(5001), tipo: "fala" }] }])
    assert.throws(() => toApiDraft({ ...draft, ...change }))
})
test("malformed API records never become silently empty scripts", () => {
  for (const change of [{ _id: "../id" }, { updatedAt: "not-date" }, { blocos: [] }, { blocos: [{ tipo: "unknown", texto: "Oi", ordem: 1 }] }]) assert.throws(() => fromApiScript({ ...record, ...change }))
})
test("speech matches accents, case and punctuation", () => {
  assert.equal(alignTranscript(['Você', 'está', 'assistindo', 'ao', 'jornal.'], 'voce esta assistindo', 0, false), 3)
})
test("silence and unrelated speech preserve position", () => {
  assert.equal(alignTranscript(['Boa', 'noite', 'Brasil'], '', 0, true), null)
  assert.equal(alignTranscript(['Boa', 'noite', 'Brasil'], 'hoje falaremos sobre receitas', 0, true), null)
})
test("distant jump needs an unambiguous final phrase", () => {
  const words = ['Boa', 'noite', ...Array(30).fill('texto'), 'No', 'esporte', 'o', 'time', 'venceu']
  assert.equal(alignTranscript(words, 'No esporte o time', 0, false), null)
  assert.equal(alignTranscript(words, 'No esporte o time', 0, true), 36)
  assert.equal(alignTranscript(words, 'esporte', 0, true), null)
})
test("ambiguous repeated phrases do not jump and voice never rewinds", () => {
  const words = [...Array(10).fill('texto'), 'boa', 'noite', 'a', 'todos', ...Array(10).fill('texto'), 'boa', 'noite', 'a', 'todos']
  assert.equal(alignTranscript(words, 'boa noite a todos', 0, true), null)
  assert.equal(alignTranscript(['boa', 'noite', 'amigos'], 'boa noite', 3, true), null)
})
test("short final words advance only at the current position", () => {
  assert.equal(alignTranscript(['Brasil', 'hoje'], 'Brasil', 0, true), 1)
  assert.equal(alignTranscript(['fala', 'extra', 'Brasil'], 'Brasil', 0, true), null)
})
const envelope = { channel: protocol.projectionChannel, presentationId: '00000000-0000-4000-8000-000000000001', receiverId: '00000000-0000-4000-8000-000000000002', sequence: 1 }
const state = { ...envelope, type: 'state', index: 0, readingState: 'waiting', settings: { fontSize: 64, lineHeight: 1.55, highContrast: false, mirrorHorizontal: false, mirrorVertical: false } }
test("projection rejects invalid channel, ids, settings and indexes", () => {
  assert.ok(protocol.isOwnerMessage(state))
  for (const change of [{ channel: 'foreign' }, { presentationId: 'invalid' }, { sequence: -1 }, { index: -1 }, { settings: { ...state.settings, fontSize: 999 } }]) assert.equal(protocol.isOwnerMessage({ ...state, ...change }), false)
})
test("projection position and completion are consistent", () => {
  assert.ok(protocol.isValidPosition(state, 10))
  assert.equal(protocol.isValidPosition({ ...state, index: 3 }, 10), false)
  assert.ok(protocol.isValidPosition({ ...state, readingState: 'completed', index: 10 }, 10))
  assert.equal(protocol.isValidPosition({ ...state, readingState: 'completed', index: 9 }, 10), false)
})
