import { test } from "node:test"
import assert from "node:assert/strict"
import { pathToFileURL } from "node:url"
import { join } from "node:path"
import "@angular/compiler"
const { ApiClient } = await import(pathToFileURL(join(process.env.TEST_MODULE_ROOT, "core/api-client.service.js")))
const user = { id: "0123456789abcdef01234567", nome: "Teste", email: "teste@example.test", perfil: "admin" }
const token = `header.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now()/1000)+600 })).toString('base64url')}.signature`
const response = (data, status=200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })

test("login sends backend names, then attaches Bearer only to protected requests", async () => {
  const original = globalThis.fetch; const calls=[]; const api = new ApiClient()
  try {
    globalThis.fetch = async (url, options) => { calls.push({ url, options }); return response(url.endsWith('login') ? { token, usuario: user } : { roteiros: [] }) }
    await api.login(' TESTE@EXAMPLE.TEST ', 'password')
    await api.request('GET', '/roteiros')
    assert.deepEqual(JSON.parse(calls[0].options.body), { email: 'teste@example.test', senha: 'password' })
    assert.equal(calls[0].options.headers.Authorization, undefined)
    assert.equal(calls[1].options.headers.Authorization, `Bearer ${token}`)
    assert.ok(api.isSignedIn())
    api.logout(); assert.equal(api.isSignedIn(), false)
  } finally { api.logout(); globalThis.fetch = original }
})
test("401 invalidates session; 403 preserves it and exposes the API message", async () => {
  const original = globalThis.fetch; const api=new ApiClient(); let status=200
  try {
    globalThis.fetch = async (url) => url.endsWith('login') ? response({ token, usuario:user }) : response({ mensagem: 'Acesso recusado' }, status)
    await api.login('teste@example.test','password')
    status=403; await assert.rejects(api.request('GET','/roteiros'), /Acesso recusado/); assert.ok(api.isSignedIn())
    status=401; await assert.rejects(api.request('GET','/roteiros'), /Acesso recusado/); assert.equal(api.isSignedIn(), false); assert.ok(api.expired())
  } finally { api.logout(); globalThis.fetch=original }
})
test("unconfirmed POST is never retried automatically", async () => {
  const original=globalThis.fetch; const api=new ApiClient(); let writes=0
  try {
    globalThis.fetch=async (url) => { if(url.endsWith('login')) return response({ token, usuario:user }); writes++; throw new TypeError('network') }
    await api.login('teste@example.test','password')
    await assert.rejects(api.request('POST','/roteiros',{}), /Consulte a lista/)
    assert.equal(writes,1)
  } finally { api.logout(); globalThis.fetch=original }
})
test("logout invalidates in-flight responses", async () => {
  const original=globalThis.fetch; const api=new ApiClient(); let release
  try {
    globalThis.fetch=async (url) => url.endsWith('login') ? response({ token, usuario:user }) : await new Promise(resolve => { release=resolve })
    await api.login('teste@example.test','password')
    const pending=api.request('GET','/roteiros'); api.logout(); release(response({ roteiros:[] }))
    await assert.rejects(pending, /sessão mudou/)
  } finally { api.logout(); globalThis.fetch=original }
})

test("logout also invalidates a response whose JSON body is still loading", async () => {
  const original=globalThis.fetch; const api=new ApiClient(); let releaseBody, bodyStarted
  const waiting = new Promise(resolve => { bodyStarted=resolve })
  try {
    globalThis.fetch=async (url) => url.endsWith('login') ? response({ token, usuario:user }) : {
      ok:true, status:200, json:() => { bodyStarted(); return new Promise(resolve => { releaseBody=resolve }) }
    }
    await api.login('teste@example.test','password')
    const pending=api.request('GET','/roteiros'); await waiting
    api.logout(); releaseBody({ roteiros:[] })
    await assert.rejects(pending, /sessão mudou/)
  } finally { api.logout(); globalThis.fetch=original }
})

test("PATCH sends an authenticated draft and accepts an empty 204 response", async () => {
  const original = globalThis.fetch; const calls=[]; const api = new ApiClient()
  try {
    globalThis.fetch = async (url, options) => {
      calls.push({url, options})
      if (url.endsWith('/auth/login')) return response({ token, usuario:user })
      if (options.method === 'PATCH') return new Response(null, {status:204})
      return response({roteiro:{}})
    }
    await api.login('teste@example.test', 'password')
    const draft = { titulo:'Teste atualizado', categoria:'tecnologia', blocos:[{ordem:1,tipo:'fala',texto:'Boa noite.'}] }
    assert.deepEqual(await api.request('PATCH','/roteiros/0123456789abcdef01234567', draft), {})
    const patch = calls.find(call => call.options.method === 'PATCH')
    assert.equal(patch.url, '/api/roteiros/0123456789abcdef01234567')
    assert.deepEqual(JSON.parse(patch.options.body), draft)
    assert.equal(patch.options.headers.Authorization, `Bearer ${token}`)
  } finally { api.logout(); globalThis.fetch = original }
})

test("DELETE archives via Bearer, sends no body and does not retry on an unconfirmed response", async () => {
  const original = globalThis.fetch; const calls=[]; const api = new ApiClient()
  try {
    let fail=false
    globalThis.fetch = async (url, options) => {
      calls.push({url, options})
      if (url.endsWith('/auth/login')) return response({token, usuario:user})
      if (fail) throw new TypeError('network')
      return new Response(null, {status:204})
    }
    await api.login('teste@example.test', 'password')
    const id='0123456789abcdef01234567'
    assert.deepEqual(await api.request('DELETE', `/roteiros/${id}`), {})
    assert.equal(calls[1].options.method, 'DELETE')
    assert.equal(calls[1].options.body, undefined)
    assert.equal(calls[1].options.headers.Authorization, `Bearer ${token}`)
    fail=true
    await assert.rejects(api.request('DELETE', `/roteiros/${id}`), /Atualize a lista/)
    assert.equal(calls.filter(call => call.options.method === 'DELETE').length, 2)
  } finally { api.logout(); globalThis.fetch=original }
})
