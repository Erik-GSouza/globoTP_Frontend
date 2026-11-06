import { Injectable, signal } from "@angular/core"

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}
export interface Account {
  id: string
  nome: string
  email: string
  perfil: string
}

@Injectable({ providedIn: "root" })
export class ApiClient {
  private token: string | null = null
  private generation = 0
  private expiryTimer: ReturnType<typeof setTimeout> | undefined
  readonly account = signal<Account | null>(null)
  readonly expired = signal(false)
  isSignedIn(): boolean {
    return this.token !== null && this.account() !== null
  }

  async login(email: string, password: string): Promise<void> {
    const data = await this.request(
      "POST",
      "/auth/login",
      { email: email.trim().toLowerCase(), senha: password },
      false,
    )
    const user = data["usuario"] as Account | undefined
    if (
      typeof data["token"] !== "string" ||
      !user ||
      typeof user.id !== "string" ||
      typeof user.nome !== "string" ||
      typeof user.email !== "string"
    )
      throw new ApiError(
        "O servidor retornou uma resposta de login inválida.",
        502,
      )
    if (user.perfil !== "admin")
      throw new ApiError(
        "Entre com uma conta de administrador do projeto.",
        403,
      )
    let expiry: number
    try {
      const payload = JSON.parse(
        atob(data["token"].split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      )
      expiry = Number(payload.exp) * 1000
      if (!Number.isFinite(expiry) || expiry <= Date.now()) throw new Error()
    } catch {
      throw new ApiError("O servidor retornou uma sessão inválida.", 502)
    }
    this.logout()
    this.token = data["token"]
    this.account.set(user)
    this.expired.set(false)
    // UI expiry is not a substitute for the backend's JWT verification.
    this.expiryTimer = setTimeout(
      () => this.logout(true),
      Math.min(expiry - Date.now(), 2_147_483_647),
    )
  }
  logout(expired = false): void {
    clearTimeout(this.expiryTimer)
    this.generation++
    this.token = null
    this.account.set(null)
    this.expired.set(expired)
  }
  async request(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    body?: unknown,
    authenticated = true,
  ): Promise<Record<string, unknown>> {
    if (authenticated && !this.isSignedIn())
      throw new ApiError("Sua sessão terminou. Entre novamente.", 401)
    const generation = this.generation
    const headers: Record<string, string> = { Accept: "application/json" }
    if (body !== undefined) headers["Content-Type"] = "application/json"
    if (authenticated && this.token)
      headers["Authorization"] = `Bearer ${this.token}`
    try {
      const response = await fetch(`/api${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
        credentials: "omit",
      })
      if (generation !== this.generation)
        throw new ApiError(
          "A sessão mudou. Repita a operação após entrar.",
          401,
        )
      const data: unknown = await response.json().catch(() => null)
      // Logout may also happen while the response body is still arriving.
      if (generation !== this.generation)
        throw new ApiError(
          "A sessão mudou. Repita a operação após entrar.",
          401,
        )
      if (!response.ok) {
        if (authenticated && response.status === 401) this.logout(true)
        const message =
          data &&
          typeof data === "object" &&
          "mensagem" in data &&
          typeof data.mensagem === "string"
            ? data.mensagem
            : response.status === 429
              ? "Muitas tentativas. Aguarde antes de tentar novamente."
              : "Não foi possível concluir a operação no servidor."
        throw new ApiError(message, response.status)
      }
      // PATCH/DELETE may return an empty successful body. The caller must
      // read the resource/list again before showing confirmed success.
      if (data === null && (method === "PATCH" || method === "DELETE"))
        return {}
      if (!data || typeof data !== "object" || Array.isArray(data))
        throw new ApiError("O servidor retornou uma resposta inválida.", 502)
      return data as Record<string, unknown>
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        method === "POST" && authenticated
          ? "Não foi possível confirmar o cadastro. Consulte a lista antes de tentar salvar novamente."
          : (method === "PATCH" || method === "DELETE") && authenticated
            ? "Não foi possível confirmar a alteração. Atualize a lista antes de tentar novamente."
            : "Não foi possível conectar ao servidor. Verifique a conexão e tente novamente.",
        0,
      )
    }
  }
}
