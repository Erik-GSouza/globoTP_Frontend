import { DestroyRef, Injectable, computed, inject, signal } from "@angular/core"
import { createReaderScript } from "../models/script.model"
import { createPresentationId } from "./presentation-id"
import {
  defaultPresenterSettings,
  type PresentationScript,
} from "./presentation.model"
import {
  isOwnerMessage,
  isPresentationId,
  isValidPosition,
  projectionChannel,
  projectionLeaseMs,
  type PlaybackSnapshot,
  type ReceiverMessage,
} from "./projection.protocol"

export type ProjectionPhase = "waiting" | "linked" | "unlinked" | "lost" | "ended"

@Injectable()
export class ProjectionReceiverService {
  private readonly document = signal<PresentationScript | null>(null)
  private readonly playback = signal<PlaybackSnapshot | null>(null)
  private readonly linkPhase = signal<ProjectionPhase>("unlinked")
  private owner: Window | null = null
  private ownerDocument: Document | null = null
  private presentationId = ""
  private receiverId = ""
  private lastSeen = 0
  private lastSequence = -1
  private monitorTimer: number | undefined
  private readonly origin = window.location.origin

  readonly script = this.document.asReadonly()
  readonly phase = this.linkPhase.asReadonly()
  readonly reader = computed(() =>
    createReaderScript(this.document()?.content ?? ""),
  )
  readonly index = computed(() => this.playback()?.index ?? 0)
  readonly state = computed(() => this.playback()?.readingState ?? "waiting")
  readonly settings = computed(
    () => this.playback()?.settings ?? defaultPresenterSettings(),
  )
  readonly message = computed(() => {
    if (this.phase() === "ended")
      return "Apresentação encerrada. Abra uma nova apresentação pelo operador."
    if (this.phase() === "lost")
      return "Vínculo com a apresentação perdido. Recarregue esta janela ou abra novamente pelo operador."
    if (this.phase() === "waiting") return "Conectando à apresentação…"
    return "Abra o apresentador pelo operador para exibir um roteiro nesta janela."
  })

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop())
  }

  connect(presentationId: string): void {
    this.stop()
    if (
      !isPresentationId(presentationId) ||
      !window.opener ||
      window.opener === window
    )
      return
    this.owner = (window.opener as Window)
    try {
      this.ownerDocument = this.owner.document
    } catch {
      this.finish("unlinked")
      return
    }
    this.presentationId = presentationId
    this.receiverId = createPresentationId()
    this.lastSeen = Date.now()
    this.lastSequence = -1
    this.linkPhase.set("waiting")
    window.addEventListener("message", this.onMessage)
    window.addEventListener("pagehide", this.onPageHide)
    this.request("ready")
    this.monitorTimer = window.setInterval(this.checkLink, 1000)
  }

  stop(): void {
    this.request("detach")
    this.dispose()
    this.document.set(null)
    this.playback.set(null)
    this.linkPhase.set("unlinked")
  }

  private readonly onPageHide = (): void => this.stop()

  private readonly checkLink = (): void => {
    if (this.owner?.closed) {
      this.finish("ended")
      return
    }
    // Messages sent during a document unload can be dropped. A controller reload
    // replaces its Document even when its WindowProxy and URL stay unchanged.
    try {
      if (this.owner && this.owner.document !== this.ownerDocument) {
        this.finish("ended")
        return
      }
    } catch {
      this.finish("ended")
      return
    }
    if (
      !this.owner ||
      this.owner.closed ||
      Date.now() - this.lastSeen > projectionLeaseMs
    ) {
      this.finish(this.phase() === "waiting" ? "unlinked" : "lost")
      return
    }
    if (this.phase() === "waiting") this.request("ready")
  }

  private readonly onMessage = (event: MessageEvent<unknown>): void => {
    if (
      event.origin !== this.origin ||
      event.source !== this.owner ||
      !isOwnerMessage(event.data)
    )
      return
    const message = event.data
    if (
      message.presentationId !== this.presentationId ||
      message.receiverId !== this.receiverId ||
      message.sequence <= this.lastSequence
    )
      return
    if (message.type === "end") {
      this.finish("ended")
      return
    }
    if (message.type === "heartbeat") {
      if (this.phase() === "linked") {
        this.lastSeen = Date.now()
        this.lastSequence = message.sequence
        this.request("pong")
      }
      return
    }
    if (message.type !== "init" && message.type !== "state") return
    if (message.type === "init") {
      const total = createReaderScript(message.script.content).totalWords
      if (!isValidPosition(message, total)) return
      this.document.set({ ...message.script })
      this.linkPhase.set("linked")
    } else if (
      this.phase() !== "linked" ||
      !isValidPosition(message, this.reader().totalWords)
    )
      return
    this.lastSequence = message.sequence
    this.lastSeen = Date.now()
    this.playback.set({
      index: message.index,
      readingState: message.readingState,
      settings: { ...message.settings },
    })
    this.request("pong")
  }

  private request(type: ReceiverMessage["type"]): void {
    if (!this.owner || !this.presentationId || !this.receiverId) return
    try {
      this.owner.postMessage(
        {
          channel: projectionChannel,
          type,
          presentationId: this.presentationId,
          receiverId: this.receiverId,
        } satisfies ReceiverMessage,
        this.origin,
      )
    } catch {
      // The liveness deadline also covers navigation or a failed delivery.
    }
  }

  private finish(phase: ProjectionPhase): void {
    this.dispose()
    this.document.set(null)
    this.playback.set(null)
    this.linkPhase.set(phase)
  }

  private dispose(): void {
    window.clearInterval(this.monitorTimer)
    this.monitorTimer = undefined
    window.removeEventListener("message", this.onMessage)
    window.removeEventListener("pagehide", this.onPageHide)
    this.owner = null
    this.ownerDocument = null
    this.presentationId = ""
    this.receiverId = ""
    this.lastSequence = -1
  }
}
