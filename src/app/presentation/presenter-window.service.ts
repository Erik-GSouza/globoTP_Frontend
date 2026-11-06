import { DestroyRef, Injectable, effect, inject, signal } from "@angular/core"
import { PresentationService } from "./presentation.service"
import {
  isReceiverMessage,
  projectionChannel,
  projectionLeaseMs,
  type OwnerMessage,
} from "./projection.protocol"

@Injectable()
export class PresenterWindowService {
  private readonly presentation = inject(PresentationService)
  private readonly connected = signal(false)
  private readonly opened = signal(false)
  private readonly feedback = signal<string | null>(null)
  private child: Window | null = null
  private presentationId: string | null = null
  private receiverId: string | null = null
  private sequence = 0
  private lastSeen = 0
  private heartbeatTimer: number | undefined
  private readonly origin = window.location.origin

  readonly isConnected = this.connected.asReadonly()
  readonly isOpen = this.opened.asReadonly()
  readonly notice = this.feedback.asReadonly()

  constructor() {
    window.addEventListener("message", this.onMessage)
    window.addEventListener("pagehide", this.onPageHide)
    effect(() => {
      const active = this.presentation.active()
      this.presentation.index()
      this.presentation.state()
      this.presentation.presenterSettings()
      const connected = this.connected()
      if (this.presentationId && active?.id !== this.presentationId) this.end()
      else if (active && connected) this.sendState(false)
    })
    inject(DestroyRef).onDestroy(() => {
      this.end()
      window.removeEventListener("message", this.onMessage)
      window.removeEventListener("pagehide", this.onPageHide)
    })
  }

  open(): void {
    const active = this.presentation.active()
    if (!active) return
    if (this.child && !this.child.closed && this.presentationId === active.id) {
      this.child.focus()
      return
    }
    this.end()
    const url = new URL(`projecao/${active.id}`, document.baseURI)
    try {
      this.child = window.open(
        url.href,
        `tpglobo-presenter-${active.id}`,
        "popup,width=1280,height=800",
      )
    } catch {
      this.child = null
    }
    if (!this.child) {
      this.feedback.set(
        "O navegador bloqueou a nova janela. Permita pop-ups ou use a visão do apresentador nesta aba.",
      )
      return
    }
    this.presentationId = active.id
    this.opened.set(true)
    this.lastSeen = Date.now()
    this.feedback.set(
      "Janela do apresentador aberta. Você pode movê-la para outro monitor.",
    )
    this.heartbeatTimer = window.setInterval(this.checkConnection, 1000)
  }

  end(): void {
    this.sendControl("end")
    window.clearInterval(this.heartbeatTimer)
    this.heartbeatTimer = undefined
    this.child = null
    this.receiverId = null
    this.presentationId = null
    this.sequence = 0
    this.connected.set(false)
    this.opened.set(false)
    this.feedback.set(null)
  }

  private readonly onPageHide = (): void => {
    this.end()
    this.presentation.end()
  }

  private readonly onMessage = (event: MessageEvent<unknown>): void => {
    if (
      event.origin !== this.origin ||
      event.source !== this.child ||
      !isReceiverMessage(event.data)
    )
      return
    const message = event.data
    if (
      message.presentationId !== this.presentationId ||
      message.presentationId !== this.presentation.active()?.id
    )
      return
    if (message.type === "ready") {
      this.receiverId = message.receiverId
      this.lastSeen = Date.now()
      this.connected.set(true)
      this.feedback.set("Janela do apresentador conectada.")
      this.sendState(true)
    } else if (message.receiverId === this.receiverId) {
      if (message.type === "pong") {
        this.lastSeen = Date.now()
        this.connected.set(true)
      } else {
        // Retain WindowProxy during reload so the new document can re-bind.
        this.receiverId = null
        this.connected.set(false)
      }
    }
  }

  private readonly checkConnection = (): void => {
    if (!this.child || this.child.closed) {
      this.end()
      this.feedback.set(
        "Janela do apresentador fechada. Você pode abri-la novamente.",
      )
      return
    }
    if (Date.now() - this.lastSeen > projectionLeaseMs) {
      this.connected.set(false)
      this.feedback.set(
        "A janela do apresentador não está respondendo. Recarregue essa janela ou abra-a novamente.",
      )
    }
    this.sendControl("heartbeat")
  }

  private sendState(initial: boolean): void {
    const active = this.presentation.active()
    const presentationId = this.presentationId
    const receiverId = this.receiverId
    if (
      !active ||
      active.id !== presentationId ||
      !presentationId ||
      !receiverId
    )
      return
    const base = {
      channel: projectionChannel,
      presentationId,
      receiverId,
      sequence: ++this.sequence,
      index: this.presentation.index(),
      readingState: this.presentation.state(),
      settings: this.presentation.presenterSettings(),
    } as const
    // Full content is only sent for initial/reloaded receivers, not for word updates.
    this.post(
      initial
        ? { ...base, type: "init", script: active.script }
        : { ...base, type: "state" },
    )
  }

  private sendControl(type: "heartbeat" | "end"): void {
    if (!this.presentationId || !this.receiverId) return
    this.post({
      channel: projectionChannel,
      type,
      presentationId: this.presentationId,
      receiverId: this.receiverId,
      sequence: ++this.sequence,
    })
  }

  private post(message: OwnerMessage): void {
    try {
      this.child?.postMessage(message, this.origin)
    } catch {
      this.connected.set(false)
    }
  }
}
