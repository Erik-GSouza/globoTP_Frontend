import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  ViewChild,
} from "@angular/core"
import type { ScriptWord } from "../models/script.model"

@Component({
  selector: "tp-script-reader",
  standalone: true,
  templateUrl: "./script-reader.component.html",
  styleUrl: "./script-reader.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScriptReaderComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  @Input({ required: true }) lines: ReadonlyArray<ReadonlyArray<ScriptWord>> =
    []
  @Input() fontSize = 48
  @Input() lineHeight = 1.55
  @Input() currentWordIndex = 0
  @Input() highContrast = false
  @Input() clean = false
  @Input() interactive = false
  @Input() mirrorHorizontal = false
  @Input() mirrorVertical = false
  @Output() readonly wordSelected = new EventEmitter<number>()
  @ViewChild("viewport") private viewport?: ElementRef<HTMLDivElement>

  private resizeObserver?: ResizeObserver
  private alignmentFrame: number | undefined

  get focusWordIndex(): number {
    return Math.min(
      this.currentWordIndex,
      this.lines.at(-1)?.at(-1)?.index ?? 0,
    )
  }

  get textTransform(): string {
    return `scale(${this.mirrorHorizontal ? -1 : 1}, ${
      this.mirrorVertical ? -1 : 1
    })`
  }

  ngAfterViewInit(): void {
    this.resizeObserver = new ResizeObserver(() => this.scheduleAlignment())
    if (this.viewport) this.resizeObserver.observe(this.viewport.nativeElement)
    this.scheduleAlignment()
  }

  ngOnChanges(): void {
    this.scheduleAlignment()
  }

  private scheduleAlignment(): void {
    if (this.alignmentFrame !== undefined)
      cancelAnimationFrame(this.alignmentFrame)
    this.alignmentFrame = requestAnimationFrame(() => {
      this.alignmentFrame = undefined
      const viewport = this.viewport?.nativeElement
      const word = viewport?.querySelector<HTMLElement>(
        `[data-word-index="${this.focusWordIndex}"]`,
      )
      if (!viewport || !word) return
      // Only the text is transformed. Its visual bounds include either mirror axis;
      // scrolling stays untransformed and aligns the logical word in all four cases.
      const wordBounds = word.getBoundingClientRect()
      const viewportBounds = viewport.getBoundingClientRect()
      viewport.scrollTop +=
        wordBounds.top +
        wordBounds.height / 2 -
        viewportBounds.top -
        viewport.clientHeight * 0.35
    })
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect()
    if (this.alignmentFrame !== undefined)
      cancelAnimationFrame(this.alignmentFrame)
  }
}
