import { Injectable, computed, inject, signal } from "@angular/core"
import { createReaderScript, type Script } from "../models/script.model"
import {
  defaultOperatorSettings,
  defaultPresenterSettings,
  type ActivePresentation,
  type PresentationView,
  type ReadingState,
} from "./presentation.model"

import { SpeechService } from "./speech.service"
import { alignTranscript } from "./speech-alignment"
import { createPresentationId } from "./presentation-id"

@Injectable({ providedIn: "root" })
export class PresentationService {
  private readonly current = signal<ActivePresentation | null>(null)
  private readonly position = signal(0)
  private readonly status = signal<ReadingState>("waiting")
  readonly speech = inject(SpeechService)
  readonly mode = signal<"voice" | "manual">("voice")
  readonly matchFound = signal<boolean | null>(null)
  private readonly operator = signal(defaultOperatorSettings())
  private readonly presenter = signal(defaultPresenterSettings())
  private readonly currentView = signal<PresentationView>("operator")

  readonly active = this.current.asReadonly()
  readonly index = this.position.asReadonly()
  readonly state = this.status.asReadonly()
  readonly operatorSettings = this.operator.asReadonly()
  readonly presenterSettings = this.presenter.asReadonly()
  readonly view = this.currentView.asReadonly()
  readonly reader = computed(() =>
    createReaderScript(this.current()?.script.content ?? ""),
  )
  readonly totalWords = computed(() => this.reader().totalWords)
  readonly stateLabel = computed(() => {
    if (this.state() === "completed") return "Leitura concluída"
    if (this.state() === "paused") return "Leitura pausada"
    if (this.mode() === "manual") return "Controle manual"
    if (this.state() === "running")
      return this.speech.phase() === "starting"
        ? "Conectando microfone…"
        : "Acompanhando a fala"
    return "Aguardando início da leitura"
  })
  readonly progress = computed(() => {
    const total = this.totalWords()
    if (total === 0) return 0
    return this.index() >= total
      ? 100
      : Math.floor((this.index() / total) * 100)
  })
  readonly toggleLabel = computed(() => {
    if (this.state() === "running") return "Pausar leitura"
    if (this.state() === "paused") return "Retomar leitura"
    if (this.state() === "completed") return "Leitura concluída"
    return "Iniciar leitura por voz"
  })

  begin(script: Script): void {
    this.end()
    // Read a snapshot, never a live editor draft or a mutable stored record.
    this.current.set({
      id: createPresentationId(),
      script: { title: script.title, content: script.content },
    })
    this.operator.set(defaultOperatorSettings())
    this.presenter.set(defaultPresenterSettings())
    this.mode.set(this.speech.supported ? "voice" : "manual")
    this.matchFound.set(null)
    this.currentView.set("operator")
  }

  toggle(): void {
    if (
      !this.active() ||
      this.state() === "completed" ||
      this.mode() === "manual"
    )
      return
    if (this.state() === "running") {
      this.pause()
      return
    }
    this.status.set("running")
    this.speech.start(
      (text, final) => {
        if (!this.active() || this.state() !== "running") return
        const next = alignTranscript(
          this.reader()
            .lines.flat()
            .map((word) => word.text),
          text,
          this.index(),
          final,
        )
        this.matchFound.set(next !== null)
        if (next !== null) {
          this.position.set(next)
          if (next === this.totalWords()) {
            this.speech.stop()
            this.status.set("completed")
          }
        }
      },
      () => {
        if (this.active() && this.state() !== "completed")
          this.status.set("paused")
      },
    )
  }
  pause(): void {
    this.speech.stop()
    if (this.active() && this.state() !== "completed") this.status.set("paused")
  }
  restart(): void {
    if (!this.active()) return
    this.speech.clear()
    this.matchFound.set(null)
    this.position.set(0)
    this.status.set("waiting")
  }
  step(direction: -1 | 1): void {
    if (!this.active()) return
    this.speech.stop()
    const next = Math.max(
      0,
      Math.min(this.totalWords(), this.index() + direction),
    )
    this.position.set(next)
    this.status.set(next === this.totalWords() ? "completed" : "paused")
  }
  seek(index: number): void {
    if (!this.active() || !Number.isInteger(index)) return
    this.speech.stop()
    this.position.set(Math.max(0, Math.min(this.totalWords() - 1, index)))
    this.status.set("paused")
  }
  setMode(mode: "voice" | "manual"): void {
    this.pause()
    this.mode.set(mode)
    this.matchFound.set(null)
  }

  setView(view: PresentationView): void {
    this.currentView.set(view)
  }

  setFontSize(view: PresentationView, value: number): void {
    if (!Number.isFinite(value)) return
    const fontSize = Math.round(
      Math.max(28, Math.min(view === "operator" ? 96 : 144, value)),
    )
    if (view === "operator")
      this.operator.update((settings) => ({ ...settings, fontSize }))
    else this.presenter.update((settings) => ({ ...settings, fontSize }))
  }

  setLineHeight(view: PresentationView, value: number): void {
    if (!Number.isFinite(value)) return
    const lineHeight = Number(Math.max(1.2, Math.min(2, value)).toFixed(2))
    if (view === "operator")
      this.operator.update((settings) => ({ ...settings, lineHeight }))
    else this.presenter.update((settings) => ({ ...settings, lineHeight }))
  }

  setContrast(view: PresentationView, highContrast: boolean): void {
    if (view === "operator")
      this.operator.update((settings) => ({ ...settings, highContrast }))
    else this.presenter.update((settings) => ({ ...settings, highContrast }))
  }

  setMirror(axis: "horizontal" | "vertical", enabled: boolean): void {
    this.presenter.update((settings) =>
      axis === "horizontal"
        ? { ...settings, mirrorHorizontal: enabled }
        : { ...settings, mirrorVertical: enabled },
    )
  }

  end(): void {
    this.speech.clear()
    this.current.set(null)
    this.position.set(0)
    this.status.set("waiting")
    this.matchFound.set(null)
  }
}
