import { test } from "node:test"
import assert from "node:assert/strict"
import { pathToFileURL } from "node:url"
import { join } from "node:path"
import "@angular/compiler"
import { Injector, runInInjectionContext } from "@angular/core"

const load = name => import(pathToFileURL(join(process.env.TEST_MODULE_ROOT, `presentation/${name}.js`)))
const { SpeechService } = await load("speech.service")
const { PresentationService } = await load("presentation.service")
const { createPresentationId } = await load("presentation-id")

test("manual presentation identifiers also work without the secure-context UUID API", t => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "crypto")
  const secureRandom = globalThis.crypto.getRandomValues.bind(globalThis.crypto)
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: { getRandomValues: secureRandom } })
  t.after(() => Object.defineProperty(globalThis, "crypto", original))
  const id = createPresentationId()
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  assert.notEqual(createPresentationId(), id)
})

function environment(t, supported = true) {
  const instances = []
  class Recognition {
    aborted = 0
    constructor() { instances.push(this) }
    start() { this.onstart?.() }
    abort() { this.aborted++; this.onend?.() }
    result(text, final = true) {
      this.onresult?.({ resultIndex: 0, results: [{ 0: { transcript: text }, length: 1, isFinal: final }] })
    }
  }
  const previous = globalThis.window
  globalThis.window = { isSecureContext: true, ...(supported ? { SpeechRecognition: Recognition } : {}) }
  const speech = new SpeechService()
  t.after(() => { speech.clear(); if (previous === undefined) delete globalThis.window; else globalThis.window = previous })
  return { speech, instances }
}

test("voice starts only on request and emits interim/final results in pt-BR", t => {
  const { speech, instances } = environment(t); const received = []
  assert.equal(instances.length, 0)
  speech.start((text, final) => received.push([text, final]), () => {})
  assert.equal(instances[0].lang, "pt-BR")
  assert.equal(speech.phase(), "listening")
  instances[0].result("boa noite", false); instances[0].result("boa noite", true)
  assert.deepEqual(received, [["boa noite", false], ["boa noite", true]])
})

test("stop aborts the microphone and ignores late results or end events", t => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const { speech, instances } = environment(t); let received = 0
  speech.start(() => received++, () => {})
  speech.stop(); instances[0].result("late response"); instances[0].onend()
  t.mock.timers.tick(1000)
  assert.equal(instances[0].aborted, 1)
  assert.equal(instances.length, 1)
  assert.equal(received, 0)
  assert.equal(speech.phase(), "idle")
})

test("a new voice session ignores callbacks from the previous recognizer", t => {
  const { speech, instances } = environment(t); const received = []
  speech.start(text => received.push(`old:${text}`), () => {})
  speech.start(text => received.push(`new:${text}`), () => {})
  instances[0].result("old"); instances[1].result("current")
  assert.deepEqual(received, ["new:current"])
})

test("permission failure pauses once and never retries access", t => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const { speech, instances } = environment(t); let stopped = 0
  speech.start(() => {}, () => stopped++)
  instances[0].onerror({ error: "not-allowed" })
  t.mock.timers.tick(2000)
  assert.equal(stopped, 1)
  assert.equal(instances.length, 1)
  assert.equal(speech.phase(), "error")
  assert.match(speech.notice(), /Permissão/)
})

test("unexpected endings have a bounded retry and stopping cancels pending restart", t => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const { speech, instances } = environment(t); let stopped = 0
  speech.start(() => {}, () => stopped++)
  instances[0].onend(); t.mock.timers.tick(500)
  instances[1].onend(); t.mock.timers.tick(500)
  instances[2].onend(); t.mock.timers.tick(1000)
  assert.equal(instances.length, 3); assert.equal(stopped, 1)
  speech.start(() => {}, () => {})
  instances[3].onend(); speech.stop(); t.mock.timers.tick(1000)
  assert.equal(instances.length, 4)
})

test("unsupported browsers expose manual fallback without creating a recognizer", t => {
  const { speech, instances } = environment(t, false); let stopped = false
  speech.start(() => {}, () => { stopped = true })
  assert.equal(speech.supported, false); assert.ok(stopped)
  assert.equal(instances.length, 0); assert.match(speech.notice(), /manuais/)
})

function presentation(t) {
  const { speech, instances } = environment(t)
  const injector = Injector.create({ providers: [{ provide: SpeechService, useValue: speech }] })
  const controller = runInInjectionContext(injector, () => new PresentationService())
  controller.begin({ title: "Boletim", content: "Boa noite equipe. Agora vamos às notícias." })
  t.after(() => { controller.end(); injector.destroy() })
  return { controller, speech, instances }
}

test("reading starts at zero; pause and all visual adjustments preserve the logical word", t => {
  const { controller, instances } = presentation(t)
  assert.equal(controller.progress(), 0); assert.equal(instances.length, 0)
  controller.toggle(); instances[0].result("boa noite")
  assert.equal(controller.index(), 2)
  controller.pause(); controller.setFontSize("operator", 80); controller.setFontSize("presenter", 120)
  controller.setLineHeight("presenter", 1.9); controller.setMirror("vertical", true)
  controller.setContrast("presenter", true); controller.setView("presenter")
  assert.equal(controller.index(), 2); assert.equal(controller.state(), "paused")
  assert.equal(instances[0].aborted, 1)
  controller.restart(); assert.equal(controller.index(), 0); assert.equal(controller.presenterSettings().fontSize, 120)
})

test("manual reposition pauses listening, and completion stops at 100 percent", t => {
  const { controller, instances } = presentation(t)
  controller.toggle(); controller.seek(3)
  assert.equal(instances[0].aborted, 1); assert.equal(controller.state(), "paused")
  controller.toggle(); instances[1].result("agora vamos às notícias")
  assert.equal(controller.progress(), 100); assert.equal(controller.state(), "completed")
  assert.equal(instances[1].aborted, 1)
  controller.step(-1); assert.equal(controller.state(), "paused"); assert.equal(controller.index(), 6)
})

test("changing mode or ending a presentation leaves no active microphone", t => {
  const { controller, instances } = presentation(t)
  controller.toggle(); controller.setMode("manual"); controller.toggle()
  assert.equal(instances.length, 1); assert.equal(instances[0].aborted, 1)
  controller.step(1); assert.equal(controller.index(), 1)
  controller.setMode("voice"); controller.toggle(); controller.end()
  instances[1].result("boa noite equipe")
  assert.equal(controller.active(), null); assert.equal(controller.index(), 0); assert.equal(instances[1].aborted, 1)
})
