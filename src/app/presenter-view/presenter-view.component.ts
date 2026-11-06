import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
  inject,
  signal,
} from "@angular/core"
import { createReaderScript } from "../models/script.model"
import {
  defaultPresenterSettings,
  type PresenterSettings,
} from "../presentation/presentation.model"
import { ScriptReaderComponent } from "../script-reader/script-reader.component"

@Component({
  selector: "tp-presenter-view",
  standalone: true,
  imports: [ScriptReaderComponent],
  templateUrl: "./presenter-view.component.html",
  styleUrl: "./presenter-view.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PresenterViewComponent implements OnDestroy {
  @Input({ required: true }) reader: ReturnType<typeof createReaderScript> = {
    lines: [],
    totalWords: 0,
  }
  @Input() title = ""
  @Input() index = 0
  @Input() settings: PresenterSettings = defaultPresenterSettings()
  @Input() external = false
  @Output() readonly back = new EventEmitter<void>()
  @Output() readonly close = new EventEmitter<void>()

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef)
  protected readonly isFullscreen = signal(false)
  protected readonly fullscreenNotice = signal<string | null>(null)
  protected readonly isChangingFullscreen = signal(false)

  @HostListener("document:fullscreenchange")
  protected onFullscreenChange(): void {
    this.isFullscreen.set(
      document.fullscreenElement === this.host.nativeElement,
    )
  }

  protected async toggleFullscreen(): Promise<void> {
    if (this.isChangingFullscreen()) return
    this.fullscreenNotice.set(null)
    const element = this.host.nativeElement
    if (
      !document.fullscreenElement &&
      (!document.fullscreenEnabled ||
        typeof element.requestFullscreen !== "function")
    ) {
      this.fullscreenNotice.set(
        "Esta janela não permite tela cheia. A leitura continua disponível.",
      )
      return
    }
    this.isChangingFullscreen.set(true)
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await element.requestFullscreen()
      this.onFullscreenChange()
    } catch {
      this.fullscreenNotice.set(
        "Não foi possível usar a tela cheia. A leitura continua disponível nesta janela.",
      )
    } finally {
      this.isChangingFullscreen.set(false)
    }
  }

  ngOnDestroy(): void {
    if (document.fullscreenElement === this.host.nativeElement) {
      void document.exitFullscreen().catch(() => undefined)
    }
  }
}
