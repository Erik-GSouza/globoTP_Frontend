import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  signal,
} from "@angular/core"
import { toSignal } from "@angular/core/rxjs-interop"
import {
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms"
import { ActivatedRoute, Router } from "@angular/router"
import { ScriptsService } from "../../core/scripts.service"
import { ApiClient } from "../../core/api-client.service"
import {
  categories,
  blockTypes,
  createReaderScript,
  type ScriptDraft,
  type BlockType,
} from "../../models/script.model"
import { plainText, parseFormattedText } from "../../models/formatted-text"
import { requiredText } from "../../shared/required-text.validator"

@Component({
  selector: "tp-scripts",
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: "./scripts.component.html",
  styleUrl: "./scripts.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScriptsComponent {
  protected readonly store = inject(ScriptsService)
  protected readonly session = inject(ApiClient)
  private readonly router = inject(Router)
  private readonly route = inject(ActivatedRoute)
  private readonly builder = inject(NonNullableFormBuilder)
  protected readonly categories = categories
  protected readonly blockTypes = blockTypes
  protected readonly formatParts = parseFormattedText
  protected readonly mode = signal<"view" | "new" | "edit">("view")
  protected readonly selectedId = signal<string | null>(null)
  protected readonly selectedScript = computed(() =>
    this.store.scripts().find((s) => s.id === this.selectedId()),
  )
  protected readonly isBusy = signal(false)
  protected readonly loading = signal(true)
  protected readonly loadFailed = signal(false)
  protected readonly submitted = signal(false)
  protected readonly notice = signal<{
    text: string
    tone: "success" | "error" | "info"
  } | null>(null)
  protected readonly search = new FormControl("", { nonNullable: true })
  private readonly searchValue = toSignal(this.search.valueChanges, {
    initialValue: "",
  })
  protected readonly filteredScripts = computed(() =>
    this.store
      .scripts()
      .filter((s) =>
        s.title
          .toLocaleLowerCase("pt-BR")
          .includes(this.searchValue().trim().toLocaleLowerCase("pt-BR")),
      ),
  )
  protected readonly blocks = this.builder.array([this.createBlock()])
  protected readonly form = this.builder.group({
    title: [
      "",
      [requiredText, Validators.minLength(3), Validators.maxLength(160)],
    ],
    category: ["", Validators.required],
    blocks: this.blocks,
  })
  private readonly draftValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  })
  private readonly originalDraft = signal("")
  readonly hasUnsavedChanges = computed(
    () =>
      this.mode() !== "view" &&
      JSON.stringify(this.draftValue()) !== this.originalDraft(),
  )

  constructor() {
    const message = this.route.snapshot.queryParamMap.get("notice")
    if (message) this.notice.set({ text: message, tone: "error" })
    void this.refresh()
  }
  private createBlock(text = "", type: BlockType = "fala") {
    return this.builder.group({
      text: [text, [requiredText, Validators.maxLength(5000)]],
      type: [type],
    })
  }
  confirmDiscard(): boolean {
    return (
      !this.hasUnsavedChanges() ||
      window.confirm("Há alterações não salvas. Deseja descartá-las?")
    )
  }
  @HostListener("window:beforeunload", ["$event"])
  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) {
      event.preventDefault()
      event.returnValue = ""
    }
  }
  protected async refresh(): Promise<void> {
    if (this.isBusy()) return
    this.loading.set(true)
    this.loadFailed.set(false)
    try {
      await this.store.load()
      if (!this.selectedScript())
        this.selectedId.set(this.store.scripts()[0]?.id ?? null)
    } catch (error) {
      this.loadFailed.set(true)
      this.showError(error)
    } finally {
      this.loading.set(false)
    }
  }
  protected selectScript(id: string): void {
    if (this.isBusy() || !this.confirmDiscard()) return
    this.selectedId.set(id)
    this.mode.set("view")
    this.notice.set(null)
  }
  private openDraft(draft: ScriptDraft): void {
    this.blocks.clear()
    for (const block of draft.blocks)
      this.blocks.push(this.createBlock(block.texto, block.tipo))
    this.form.patchValue({ title: draft.title, category: draft.category })
    this.form.markAsPristine()
    this.form.markAsUntouched()
    this.originalDraft.set(JSON.stringify(this.form.getRawValue()))
    this.submitted.set(false)
    this.notice.set(null)
  }
  protected newScript(): void {
    if (
      this.isBusy() ||
      this.loading() ||
      this.mode() === "new" ||
      !this.confirmDiscard()
    ) return
    this.openDraft({
      title: "",
      category: "",
      blocks: [{ ordem: 1, texto: "", tipo: "fala" }],
    })
    this.mode.set("new")
  }
  protected async editScript(): Promise<void> {
    const current = this.selectedScript()
    if (!current || this.isBusy() || this.loading()) return
    this.isBusy.set(true)
    this.notice.set(null)
    try {
      const latest = await this.store.findById(current.id)
      this.openDraft(latest)
      this.mode.set("edit")
    } catch (error) {
      this.showError(error)
    } finally {
      this.isBusy.set(false)
    }
  }
  protected async archiveScript(): Promise<void> {
    const current = this.selectedScript()
    if (!current || this.isBusy() || this.loading()) return
    if (
      !window.confirm(
        `Arquivar o roteiro “${current.title}”? Ele sairá da lista de roteiros ativos.`,
      )
    )
      return
    this.isBusy.set(true)
    this.notice.set(null)
    try {
      await this.store.archive(current.id)
      this.selectedId.set(this.store.scripts()[0]?.id ?? null)
      this.notice.set({
        text: "Roteiro arquivado com sucesso.",
        tone: "success",
      })
    } catch (error) {
      this.showError(error)
    } finally {
      this.isBusy.set(false)
    }
  }
  protected cancelEditing(): void {
    if (!this.isBusy() && this.confirmDiscard()) {
      this.mode.set("view")
      this.notice.set(null)
    }
  }
  protected addBlock(): void {
    if (!this.isBusy()) this.blocks.push(this.createBlock())
  }
  protected removeBlock(index: number): void {
    if (this.isBusy() || this.blocks.length < 2) return
    if (
      this.blocks.at(index).controls.text.value.trim() &&
      !window.confirm("Remover este bloco do rascunho?")
    )
      return
    this.blocks.removeAt(index)
  }
  protected moveBlock(index: number, delta: number): void {
    const next = index + delta
    if (this.isBusy() || next < 0 || next >= this.blocks.length) return
    const block = this.blocks.at(index)
    this.blocks.removeAt(index)
    this.blocks.insert(next, block)
  }
  protected applyFormat(
    area: HTMLTextAreaElement,
    index: number,
    marker: string,
  ): void {
    if (this.isBusy()) return
    const start = area.selectionStart,
      end = area.selectionEnd
    if (start === end) {
      this.notice.set({
        text: "Selecione um trecho no bloco para aplicar a formatação.",
        tone: "info",
      })
      return
    }
    const before = marker.startsWith("color:") ? "[" : marker
    const after = marker.startsWith("color:") ? `]{${marker.slice(6)}}` : marker
    const control = this.blocks.at(index).controls.text
    if (control.value.length + before.length + after.length > 5000) {
      this.notice.set({
        text: "O bloco atingiu o limite de 5.000 caracteres.",
        tone: "error",
      })
      return
    }
    const text = control.value
    control.setValue(
      text.slice(0, start) +
        before +
        text.slice(start, end) +
        after +
        text.slice(end),
    )
    control.markAsDirty()
    area.focus()
    area.setSelectionRange(start + before.length, end + before.length)
  }
  protected async save(): Promise<void> {
    if (this.isBusy() || this.loading()) return
    this.submitted.set(true)
    this.form.markAllAsTouched()
    if (this.form.invalid) return
    const value = this.form.getRawValue()
    if (value.blocks.some((b) => !plainText(b.text).trim())) {
      this.notice.set({
        text: "Preencha o texto de cada bloco.",
        tone: "error",
      })
      return
    }
    const draft: ScriptDraft = {
      title: value.title,
      category: value.category,
      blocks: value.blocks.map((b, i) => ({
        ordem: i + 1,
        texto: b.text,
        tipo: b.type,
      })),
    }
    this.isBusy.set(true)
    this.notice.set(null)
    try {
      const editingId = this.mode() === "edit" ? this.selectedId() : null
      if (this.mode() === "edit" && !editingId)
        throw new Error("Selecione um roteiro para editar.")
      const saved = editingId
        ? await this.store.update(editingId, draft)
        : await this.store.create(draft)
      this.selectedId.set(saved.id)
      this.mode.set("view")
      this.notice.set({
        text: editingId
          ? "Roteiro atualizado com sucesso."
          : "Roteiro cadastrado com sucesso.",
        tone: "success",
      })
    } catch (error) {
      this.showError(error)
    } finally {
      this.isBusy.set(false)
    }
  }
  protected async present(): Promise<void> {
    const script = this.selectedScript()
    if (!script || this.isBusy() || this.mode() !== "view") return
    if (!createReaderScript(script.content).totalWords) {
      this.notice.set({
        text: "Adicione um bloco de fala para apresentar este roteiro.",
        tone: "info",
      })
      return
    }
    this.isBusy.set(true)
    try {
      await this.router.navigate(["/operador", script.id])
    } catch (error) {
      this.showError(error)
    } finally {
      this.isBusy.set(false)
    }
  }
  protected async logout(): Promise<void> {
    if (this.isBusy() || !this.confirmDiscard()) return
    this.mode.set("view")
    this.session.logout()
    await this.router.navigateByUrl("/login", { replaceUrl: true })
  }
  protected formatDate(value: string): string {
    return new Date(value).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    })
  }
  protected preview(content: string): string {
    return (
      plainText(content)
        .split(/\r?\n/)
        .find((line) => line.trim()) ?? ""
    )
  }
  protected categoryLabel(value: string): string {
    return categories.find(([key]) => key === value)?.[1] ?? value
  }
  protected blockTypeLabel(value: string): string {
    return blockTypes.find(([key]) => key === value)?.[1] ?? value
  }
  private showError(error: unknown): void {
    this.notice.set({
      text:
        error instanceof Error
          ? error.message
          : "Não foi possível concluir a operação.",
      tone: "error",
    })
  }
}
