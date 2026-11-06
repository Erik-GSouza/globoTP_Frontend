import type {
  PresentationScript,
  PresenterSettings,
  ReadingState,
} from "./presentation.model"

export const projectionChannel = "tpglobo.presentation.v2"
export const projectionLeaseMs = 15_000

export interface PlaybackSnapshot {
  readonly index: number
  readonly readingState: ReadingState
  readonly settings: PresenterSettings
}

interface Envelope {
  readonly channel: typeof projectionChannel
  readonly presentationId: string
  readonly receiverId: string
}

export interface ReceiverMessage extends Envelope {
  readonly type: "ready" | "pong" | "detach"
}

interface OwnerEnvelope extends Envelope {
  readonly sequence: number
}

export interface ProjectionInit extends OwnerEnvelope, PlaybackSnapshot {
  readonly type: "init"
  readonly script: PresentationScript
}

export interface ProjectionState extends OwnerEnvelope, PlaybackSnapshot {
  readonly type: "state"
}

export interface ProjectionControl extends OwnerEnvelope {
  readonly type: "heartbeat" | "end"
}

export type OwnerMessage = ProjectionInit | ProjectionState | ProjectionControl

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function isPresentationId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
}

function isEnvelope(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    value["channel"] === projectionChannel &&
    isPresentationId(value["presentationId"]) &&
    isPresentationId(value["receiverId"])
  )
}

export function isReceiverMessage(value: unknown): value is ReceiverMessage {
  return (
    isEnvelope(value) &&
    typeof value["type"] === "string" &&
    ["ready", "pong", "detach"].includes(value["type"])
  )
}

function isSettings(value: unknown): value is PresenterSettings {
  return (
    isRecord(value) &&
    typeof value["fontSize"] === "number" &&
    Number.isInteger(value["fontSize"]) &&
    value["fontSize"] >= 28 &&
    value["fontSize"] <= 144 &&
    typeof value["lineHeight"] === "number" &&
    Number.isFinite(value["lineHeight"]) &&
    value["lineHeight"] >= 1.2 &&
    value["lineHeight"] <= 2 &&
    typeof value["highContrast"] === "boolean" &&
    typeof value["mirrorHorizontal"] === "boolean" &&
    typeof value["mirrorVertical"] === "boolean"
  )
}

export function isOwnerMessage(value: unknown): value is OwnerMessage {
  if (
    !isEnvelope(value) ||
    !Number.isInteger(value["sequence"]) ||
    Number(value["sequence"]) < 0
  )
    return false
  if (value["type"] === "heartbeat" || value["type"] === "end") return true
  if (value["type"] !== "init" && value["type"] !== "state") return false
  if (
    !Number.isInteger(value["index"]) ||
    Number(value["index"]) < 0 ||
    typeof value["readingState"] !== "string" ||
    !["waiting", "running", "paused", "completed"].includes(
      value["readingState"],
    ) ||
    !isSettings(value["settings"])
  )
    return false
  if (value["type"] === "state") return true
  const script = value["script"]
  return (
    isRecord(script) &&
    typeof script["title"] === "string" &&
    script["title"].trim().length > 0 &&
    typeof script["content"] === "string" &&
    script["content"].trim().length > 0
  )
}

export function isValidPosition(
  snapshot: PlaybackSnapshot,
  total: number,
): boolean {
  return (
    snapshot.index <= total &&
    (snapshot.readingState === "completed"
      ? snapshot.index === total
      : snapshot.index < total) &&
    (snapshot.readingState !== "waiting" || snapshot.index === 0)
  )
}
