// Test-only HTTP fixture. Never copied by the Angular build or used in production.
(() => {
  const nativeFetch = window.fetch.bind(window)
  const records = [{ _id: "0123456789abcdef01234567", titulo: "Telejornal da Noite", categoria: "outros", status: "rascunho", createdAt: "2026-11-02T18:00:00Z", updatedAt: "2026-11-02T18:00:00Z", blocos: [
    { ordem: 1, tipo: "fala", texto: "**Boa noite.** Você está assistindo ao Telejornal da Noite.\n\nAs chuvas devem voltar à Região Metropolitana a partir de amanhã, com risco de alagamentos em áreas baixas.\n\nA Defesa Civil recomenda atenção redobrada ao se deslocar durante a madrugada.\n\nNo esporte o time local venceu por dois a um e assumiu a liderança do campeonato estadual." },
    { ordem: 2, tipo: "orientacao", texto: "Preparar câmera dois para a próxima entrada." }
  ]}]
  let id = 2
  const reply = (data, status = 200) => Promise.resolve(new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } }))
  window.fetch = (input, init = {}) => {
    const url = new URL(String(input), location.origin)
    if (url.origin !== location.origin || !url.pathname.startsWith("/api/")) return nativeFetch(input, init)
    const path = url.pathname
    const body = init.body ? JSON.parse(String(init.body)) : null
    if (path === "/api/auth/login") {
      if (body.email !== "qa@tpglobo.test" || body.senha !== "TesteLocal!2026") return reply({ mensagem: "E-mail ou senha inválidos." }, 401)
      return reply({ token: `qa.${btoa(JSON.stringify({ exp: Math.floor(Date.now()/1000) + 3600 }))}.fixture`, tipo: "Bearer", usuario: { id: "0123456789abcdef01234568", nome: "Teste de interface", email: "qa@tpglobo.test", perfil: "admin" } })
    }
    if (!new Headers(init.headers).has("Authorization")) return reply({ mensagem: "Sessão necessária." }, 401)
    if (path === "/api/roteiros" && init.method === "GET") return reply({ total: records.length, roteiros: records })
    if (path === "/api/roteiros" && init.method === "POST") {
      const record = { ...body, _id: (++id).toString(16).padStart(24, "0"), status: "rascunho", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      records.unshift(record); return reply({ roteiro: record }, 201)
    }
    const found = records.find(record => path === `/api/roteiros/${record._id}`)
    if (found && init.method === "GET") return reply({ roteiro: found })
    return reply({ mensagem: "Rota não implementada na API de referência." }, 404)
  }
})()
