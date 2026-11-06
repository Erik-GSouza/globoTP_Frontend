import {
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
  effect,
  OnChanges,
  OnDestroy,
  inject,
  input,
  signal,
} from "@angular/core"
import { Router, RouterLink } from "@angular/router"
import { ApiClient } from "../../core/api-client.service"
import { blockTypes, type Script } from "../../models/script.model"
import { plainText } from "../../models/formatted-text"
import { PresentationService } from "../../presentation/presentation.service"
import { PresenterWindowService } from "../../presentation/presenter-window.service"
import { PresenterViewComponent } from "../../presenter-view/presenter-view.component"
import { ScriptReaderComponent } from "../../script-reader/script-reader.component"

@Component({
  selector: "tp-operator",
  standalone: true,
  imports: [ScriptReaderComponent, PresenterViewComponent, RouterLink],
  providers: [PresenterWindowService],
  templateUrl: "./operator.component.html",
  styleUrl: "./operator.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperatorComponent implements OnChanges, OnDestroy {
  readonly script = input.required<Script>()
  protected readonly presentation = inject(PresentationService)
  protected readonly projection = inject(PresenterWindowService)
  protected readonly session = inject(ApiClient)
  private readonly router = inject(Router)
  protected readonly time = signal(new Date())
  protected readonly productionNotes = computed(() =>
    this.script().blocks.filter((block) => block.tipo !== "fala"),
  )
  protected readonly plainText = plainText
  protected blockTypeLabel(value: string): string {
    return blockTypes.find(([key]) => key === value)?.[1] ?? value
  }
  private readonly clockTimer = window.setInterval(
    () => this.time.set(new Date()),
    1000,
  )

  constructor() {
    effect(() => {
      if (!this.session.account()) {
        this.projection.end()
        this.presentation.end()
      }
    })
  }

  protected setReadingMode(event: Event): void {
    const value = (event.target as HTMLSelectElement).value
    if (value === "voice" || value === "manual")
      this.presentation.setMode(value)
  }

  protected clockText(): string {
    return this.time().toLocaleTimeString("pt-BR", { hour12: false })
  }

  protected inputNumber(event: Event): number {
    return event.target instanceof HTMLInputElement
      ? Number(event.target.value)
      : NaN
  }

  protected inputChecked(event: Event): boolean {
    return event.target instanceof HTMLInputElement && event.target.checked
  }

  protected formatSpacing(value: number): string {
    return value.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  @HostListener("window:keydown", ["$event"])
  protected handleShortcut(event: KeyboardEvent): void {
    if (
      event.defaultPrevented ||
      event.isComposing ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey ||
      event.shiftKey
    )
      return
    const target = event.target
    if (
      target instanceof Element &&
      target.closest(
        "input, textarea, select, button, a, summary, [role=button], [role=slider], [contenteditable]:not([contenteditable=false])",
      )
    )
      return
    if (event.repeat) {
      if ([" ", "ArrowLeft", "ArrowRight", "Home"].includes(event.key))
        event.preventDefault()
      return
    }
    if (event.key === " ") this.presentation.toggle()
    else if (event.key === "ArrowLeft") this.presentation.step(-1)
    else if (event.key === "ArrowRight") this.presentation.step(1)
    else if (event.key === "Home") this.presentation.restart()
    else return
    event.preventDefault()
  }

  protected logout(): void {
    this.projection.end()
    this.presentation.end()
    this.session.logout()
    void this.router.navigateByUrl("/login", { replaceUrl: true })
  }

  ngOnChanges(): void {
    this.projection.end()
    this.presentation.begin(this.script())
  }

  ngOnDestroy(): void {
    window.clearInterval(this.clockTimer)
    this.projection.end()
    this.presentation.end()
  }
}
