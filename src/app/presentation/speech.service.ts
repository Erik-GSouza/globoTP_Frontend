import { Injectable, signal } from "@angular/core"

interface RecognitionResult {
  readonly isFinal: boolean
  readonly length: number
  readonly [index: number]: { transcript: string }
}
interface RecognitionEvent {
  resultIndex: number
  results: {
    length: number
    readonly [index: number]: RecognitionResult
  }
}
interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onstart: (() => void) | null
  onresult: ((event: RecognitionEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  abort(): void
}
type RecognitionConstructor = new () => Recognition

@Injectable({ providedIn: "root" })
export class SpeechService {
  private readonly Recognition =
    (window as unknown as {
      SpeechRecognition?: RecognitionConstructor
      webkitSpeechRecognition?: RecognitionConstructor
    }).SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: RecognitionConstructor })
      .webkitSpeechRecognition
  readonly supported = Boolean(this.Recognition) && window.isSecureContext
  readonly phase = signal<"idle" | "starting" | "listening" | "error">("idle")
  readonly notice = signal<string | null>(null)
  readonly transcript = signal("")
  private recognition: Recognition | null = null
  private restartTimer: ReturnType<typeof setTimeout> | undefined
  private wanted = false
  private restarts = 0

  start(
    onText: (text: string, final: boolean) => void,
    onStopped: () => void,
  ): void {
    this.stop()
    this.notice.set(null)
    this.transcript.set("")
    this.restarts = 0
    if (!this.Recognition || !this.supported) {
      this.notice.set(
        "Leitura por voz indisponível neste navegador ou endereço. Use os controles manuais.",
      )
      this.phase.set("error")
      onStopped()
      return
    }
    this.wanted = true
    const open = () => {
      if (!this.wanted || !this.Recognition) return
      const recognition = new this.Recognition()
      this.recognition = recognition
      recognition.lang = "pt-BR"
      recognition.continuous = true
      recognition.interimResults = true
      recognition.maxAlternatives = 1
      this.phase.set("starting")
      const active = () => this.wanted && this.recognition === recognition
      recognition.onstart = () => {
        if (active()) this.phase.set("listening")
      }
      recognition.onresult = (event) => {
        if (!active()) return
        this.restarts = 0
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          if (!result || !result.length) continue
          const text = result[0].transcript
          this.transcript.set(text.slice(-300))
          onText(text, result.isFinal)
          if (!active()) break
        }
      }
      recognition.onerror = (event) => {
        if (!active()) return
        const messages: Record<string, string> = {
          "not-allowed":
            "Permissão do microfone negada. Libere o acesso no navegador e tente novamente.",
          "service-not-allowed":
            "O serviço de reconhecimento não está disponível neste navegador.",
          "audio-capture":
            "Nenhum microfone disponível. Confira o dispositivo selecionado.",
          network:
            "O serviço de voz perdeu a conexão. A posição foi preservada.",
          "no-speech": "Nenhuma fala detectada. Retome quando estiver pronto.",
          "language-not-supported":
            "O serviço não oferece reconhecimento em português neste ambiente.",
        }
        this.stop()
        this.phase.set("error")
        this.notice.set(
          messages[event.error] ??
            "O reconhecimento foi interrompido. A posição foi preservada.",
        )
        onStopped()
      }
      recognition.onend = () => {
        if (!active()) return
        this.recognition = null
        if (++this.restarts > 2) {
          this.stop()
          this.notice.set(
            "O serviço de voz encerrou a escuta. Clique em retomar para tentar novamente.",
          )
          onStopped()
          return
        }
        this.phase.set("starting")
        this.restartTimer = setTimeout(open, 500)
      }
      try {
        recognition.start()
      } catch {
        this.stop()
        this.phase.set("error")
        this.notice.set(
          "Não foi possível iniciar o microfone. Tente novamente.",
        )
        onStopped()
      }
    }
    open()
  }
  stop(): void {
    this.wanted = false
    clearTimeout(this.restartTimer)
    const recognition = this.recognition
    this.recognition = null
    try {
      recognition?.abort()
    } catch {
      /* Already disconnected. */
    }
    this.phase.set("idle")
  }
  clear(): void {
    this.stop()
    this.transcript.set("")
    this.notice.set(null)
  }
}
