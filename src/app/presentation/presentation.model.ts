export type ReadingState = "waiting" | "running" | "paused" | "completed"
export type PresentationView = "operator" | "presenter"

export interface ReadingSettings {
  readonly fontSize: number
  readonly lineHeight: number
  readonly highContrast: boolean
}

export interface PresenterSettings extends ReadingSettings {
  readonly mirrorHorizontal: boolean
  readonly mirrorVertical: boolean
}

export interface PresentationScript {
  readonly title: string
  readonly content: string
}

export interface ActivePresentation {
  readonly id: string
  readonly script: PresentationScript
}

export const defaultOperatorSettings = (): ReadingSettings => ({
  fontSize: 48,
  lineHeight: 1.55,
  highContrast: false,
})

export const defaultPresenterSettings = (): PresenterSettings => ({
  fontSize: 64,
  lineHeight: 1.55,
  highContrast: false,
  mirrorHorizontal: false,
  mirrorVertical: false,
})
