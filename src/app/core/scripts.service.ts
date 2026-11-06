import { Injectable, effect, inject, signal } from "@angular/core"
import { ApiClient } from "./api-client.service"
import {
  fromApiScript,
  toApiDraft,
  type Script,
  type ScriptDraft,
} from "../models/script.model"

@Injectable({ providedIn: "root" })
export class ScriptsService {
  private readonly api = inject(ApiClient)
  readonly scripts = signal<ReadonlyArray<Script>>([])
  constructor() {
    effect(() => {
      if (!this.api.account()) this.scripts.set([])
    })
  }
  async load(): Promise<void> {
    const response = await this.api.request("GET", "/roteiros")
    if (!Array.isArray(response["roteiros"]))
      throw new Error("A lista retornada pelo servidor é inválida.")
    this.scripts.set(response["roteiros"].map(fromApiScript))
  }
  private checkId(id: string): void {
    if (!/^[a-f\d]{24}$/i.test(id))
      throw new Error("Identificador de roteiro inválido.")
  }
  async findById(id: string): Promise<Script> {
    this.checkId(id)
    return fromApiScript(
      (await this.api.request("GET", `/roteiros/${id}`))["roteiro"],
    )
  }
  async create(draft: ScriptDraft): Promise<Script> {
    const saved = fromApiScript(
      (await this.api.request("POST", "/roteiros", toApiDraft(draft)))[
        "roteiro"
      ],
    )
    this.scripts.update((scripts) => [
      saved,
      ...scripts.filter((s) => s.id !== saved.id),
    ])
    return saved
  }
  async update(id: string, draft: ScriptDraft): Promise<Script> {
    this.checkId(id)
    const payload = toApiDraft(draft)
    // Never assume the response envelope for PATCH. Verify the persisted
    // resource with the existing GET route before replacing the local entry.
    await this.api.request("PATCH", `/roteiros/${id}`, payload)
    let saved: Script
    try {
      saved = await this.findById(id)
    } catch {
      throw new Error(
        "A alteração foi enviada, mas não foi possível confirmar o resultado. Atualize a lista antes de salvar novamente.",
      )
    }
    const matches =
      saved.title === payload.titulo &&
      saved.category === payload.categoria &&
      JSON.stringify(saved.blocks.map((block) => ({
        ordem: block.ordem,
        texto: block.texto,
        tipo: block.tipo,
      }))) === JSON.stringify(payload.blocos)
    if (!matches)
      throw new Error(
        "O servidor não retornou os dados esperados após a edição. Atualize a lista antes de tentar novamente.",
      )
    this.scripts.update((scripts) =>
      scripts.map((script) => (script.id === saved.id ? saved : script)),
    )
    return saved
  }
  async archive(id: string): Promise<void> {
    this.checkId(id)
    // DELETE archives a script; the list endpoint omits archived records.
    // Do not remove from the local list until the server confirms it.
    await this.api.request("DELETE", `/roteiros/${id}`)
    try {
      await this.load()
    } catch {
      throw new Error(
        "O arquivamento foi enviado, mas não foi possível atualizar a lista. Atualize antes de tentar novamente.",
      )
    }
    if (this.scripts().some((script) => script.id === id))
      throw new Error(
        "O roteiro ainda aparece na lista. Confira seu estado antes de tentar arquivar novamente.",
      )
  }
}
