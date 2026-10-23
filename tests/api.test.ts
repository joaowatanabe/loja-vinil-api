import { describe, test } from "node:test"
import assert from "node:assert/strict"

const BASE = process.env.API_URL ?? "http://localhost:3000"

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(BASE + path, {
    method,
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json: any = null
  try { json = text ? JSON.parse(text) : null } catch { /* html etc. */ }
  return { status: res.status, body: json, text }
}

const unico = () => `${Date.now()}${Math.floor(Math.random() * 1e6)}`

function assertErroZod(body: any, campo: string) {
  assert.ok(Array.isArray(body.erros), "esperava { erros: [...] }")
  const e = body.erros.find((x: any) => x.campo === campo)
  assert.ok(e, `esperava erro no campo ${campo}: ${JSON.stringify(body.erros)}`)
  assert.equal(typeof e.mensagem, "string")
}

describe("Docs", () => {
  test("GET /docs -> 200", async () => {
    const r = await fetch(BASE + "/docs/")
    assert.equal(r.status, 200)
    const r2 = await fetch(BASE + "/docs")
    assert.equal(r2.status, 200)
  })
})

describe("Gêneros", () => {
  test("lista os gêneros do seed", async () => {
    const r = await api("GET", "/generos")
    assert.equal(r.status, 200)
    assert.ok(r.body.length >= 4)
    assert.ok(r.body.some((g: any) => g.nome === "House"))
  })

  test("busca por id", async () => {
    const r = await api("GET", "/generos/1")
    assert.equal(r.status, 200)
    assert.equal(r.body.id, 1)
    assert.ok(Array.isArray(r.body.discos))
  })

  test("404 para id inexistente", async () => {
    const r = await api("GET", "/generos/999999")
    assert.equal(r.status, 404)
    assert.ok(r.body.erro)
  })

  test("400 para id inválido", async () => {
    for (const id of ["abc", "0", "-1", "1.5"]) {
      const r = await api("GET", `/generos/${id}`)
      assert.equal(r.status, 400, id)
      assert.ok(r.body.erro)
    }
  })

  test("400 no formato Zod", async () => {
    const r = await api("POST", "/generos", { nome: "ab" })
    assert.equal(r.status, 400)
    assertErroZod(r.body, "nome")
  })

  test("criar, atualizar e excluir", async () => {
    const nome = `Gen${unico()}`.slice(0, 30)
    const c = await api("POST", "/generos", { nome })
    assert.equal(c.status, 201)
    assert.equal(c.body.nome, nome)
    const id = c.body.id

    const novo = `Upd${unico()}`.slice(0, 30)
    const u = await api("PUT", `/generos/${id}`, { nome: novo })
    assert.equal(u.status, 200)
    assert.equal(u.body.nome, novo)

    const g = await api("GET", `/generos/${id}`)
    assert.equal(g.body.nome, novo)

    const d = await api("DELETE", `/generos/${id}`)
    assert.equal(d.status, 200)
    assert.equal((await api("GET", `/generos/${id}`)).status, 404)
    assert.equal((await api("DELETE", `/generos/${id}`)).status, 404)
  })

  test("PUT em id inexistente -> 404", async () => {
    const r = await api("PUT", "/generos/999999", { nome: "Inexistente" })
    assert.equal(r.status, 404)
  })

  test("409 ao excluir gênero com discos", async () => {
    const r = await api("DELETE", "/generos/1")
    assert.equal(r.status, 409)
    assert.ok(r.body.erro)
    assert.equal((await api("GET", "/generos/1")).status, 200)
  })
})

describe("Discos", () => {
  const valido = (generoId = 1) => ({
    titulo: `Disco ${unico()}`.slice(0, 60),
    artista: "Artista Teste",
    ano: 2000,
    preco: 99.9,
    estoque: 3,
    generoId,
  })

  test("lista com gênero incluso", async () => {
    const r = await api("GET", "/discos")
    assert.equal(r.status, 200)
    assert.ok(r.body.length >= 6)
    assert.ok(r.body[0].genero)
  })

  test("busca por id", async () => {
    const r = await api("GET", "/discos/1")
    assert.equal(r.status, 200)
    assert.equal(r.body.titulo, "Discovery")
  })

  test("404 e 400 de id", async () => {
    assert.equal((await api("GET", "/discos/999999")).status, 404)
    assert.equal((await api("GET", "/discos/abc")).status, 400)
  })

  test("400 Zod com vários campos", async () => {
    const r = await api("POST", "/discos", { titulo: "", artista: "x", ano: 1900, preco: -1, estoque: -1, generoId: 0 })
    assert.equal(r.status, 400)
    for (const c of ["titulo", "artista", "ano", "preco", "estoque", "generoId"]) assertErroZod(r.body, c)
  })

  test("criar, atualizar e excluir", async () => {
    const dados = valido()
    const c = await api("POST", "/discos", dados)
    assert.equal(c.status, 201)
    assert.equal(c.body.titulo, dados.titulo)
    const id = c.body.id

    const u = await api("PUT", `/discos/${id}`, { ...dados, estoque: 7, preco: 120 })
    assert.equal(u.status, 200)
    assert.equal(u.body.estoque, 7)

    const g = await api("GET", `/discos/${id}`)
    assert.equal(g.body.estoque, 7)
    assert.equal(Number(g.body.preco), 120)

    assert.equal((await api("DELETE", `/discos/${id}`)).status, 200)
    assert.equal((await api("GET", `/discos/${id}`)).status, 404)
    assert.equal((await api("DELETE", `/discos/${id}`)).status, 404)
  })

  test("criar com gênero inexistente -> 409", async () => {
    const r = await api("POST", "/discos", valido(999999))
    assert.equal(r.status, 409)
  })

  test("PUT em id inexistente -> 404", async () => {
    assert.equal((await api("PUT", "/discos/999999", valido())).status, 404)
  })
})

describe("Clientes", () => {
  test("lista", async () => {
    const r = await api("GET", "/clientes")
    assert.equal(r.status, 200)
    assert.ok(r.body.length >= 3)
  })

  test("busca por id com vendas", async () => {
    const r = await api("GET", "/clientes/1")
    assert.equal(r.status, 200)
    assert.equal(r.body.email, "ana@email.com")
    assert.ok(Array.isArray(r.body.vendas))
  })

  test("404 e 400 de id", async () => {
    assert.equal((await api("GET", "/clientes/999999")).status, 404)
    assert.equal((await api("GET", "/clientes/abc")).status, 400)
  })

  test("400 Zod", async () => {
    const r = await api("POST", "/clientes", { nome: "ab", email: "invalido" })
    assert.equal(r.status, 400)
    assertErroZod(r.body, "nome")
    assertErroZod(r.body, "email")
  })

  test("criar, atualizar, 409 e excluir", async () => {
    const email = `t${unico()}@teste.com`
    const c = await api("POST", "/clientes", { nome: "Cliente Teste", email })
    assert.equal(c.status, 201)
    assert.equal(Number(c.body.totalGasto), 0)
    const id = c.body.id

    const dup = await api("POST", "/clientes", { nome: "Outro Nome", email })
    assert.equal(dup.status, 409)

    const u = await api("PUT", `/clientes/${id}`, { nome: "Nome Novo", email })
    assert.equal(u.status, 200)
    assert.equal(u.body.nome, "Nome Novo")

    assert.equal((await api("DELETE", `/clientes/${id}`)).status, 200)
    assert.equal((await api("GET", `/clientes/${id}`)).status, 404)
    assert.equal((await api("DELETE", `/clientes/${id}`)).status, 404)
  })

  test("PUT com e-mail de outro cliente -> 409", async () => {
    const r = await api("PUT", "/clientes/1", { nome: "Ana Souza", email: "bruno@email.com" })
    assert.equal(r.status, 409)
  })
})

describe("Vendas (transação)", () => {
  const snapshot = async (clienteId: number, discoId: number) => {
    const [cli, dis, ven] = await Promise.all([
      api("GET", `/clientes/${clienteId}`),
      api("GET", `/discos/${discoId}`),
      api("GET", "/vendas"),
    ])
    return {
      totalGasto: Number(cli.body.totalGasto),
      estoque: dis.body.estoque as number,
      preco: Number(dis.body.preco),
      vendas: ven.body.length as number,
    }
  }
  const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 0.001, `${a} != ${b}`)

  let vendaId = 0
  let antes: Awaited<ReturnType<typeof snapshot>>

  test("venda do último exemplar -> 201 e efeitos", async () => {
    antes = await snapshot(1, 3)
    assert.equal(antes.estoque, 1, "seed: disco 3 deve ter estoque 1")

    const r = await api("POST", "/vendas", { clienteId: 1, discoId: 3, quant: 1 })
    assert.equal(r.status, 201, r.text)
    vendaId = r.body.venda.id
    assert.equal(r.body.disco.estoque, 0)
    assert.equal(r.body.venda.clienteId, 1)
    assert.equal(r.body.venda.discoId, 3)
    near(Number(r.body.venda.preco), 219.9)

    const depois = await snapshot(1, 3)
    assert.equal(depois.estoque, 0)
    near(depois.totalGasto, antes.totalGasto + antes.preco * 1)
    assert.equal(depois.vendas, antes.vendas + 1)
  })

  test("segunda venda idêntica -> 400 e nada muda", async () => {
    const antes2 = await snapshot(1, 3)
    const r = await api("POST", "/vendas", { clienteId: 1, discoId: 3, quant: 1 })
    assert.equal(r.status, 400)
    assert.match(r.body.erro, /Estoque insuficiente/)
    const depois = await snapshot(1, 3)
    assert.deepEqual(depois, antes2)
    assert.equal(depois.estoque, 0)
  })

  test("404 para cliente inexistente sem efeitos", async () => {
    const a = await snapshot(1, 1)
    const r = await api("POST", "/vendas", { clienteId: 999999, discoId: 1, quant: 1 })
    assert.equal(r.status, 404)
    assert.deepEqual(await snapshot(1, 1), a)
  })

  test("404 para disco inexistente sem efeitos", async () => {
    const a = await snapshot(1, 1)
    const r = await api("POST", "/vendas", { clienteId: 1, discoId: 999999, quant: 1 })
    assert.equal(r.status, 404)
    assert.deepEqual(await snapshot(1, 1), a)
  })

  test("400 Zod no corpo da venda", async () => {
    const r = await api("POST", "/vendas", { clienteId: 1, discoId: 1, quant: 0 })
    assert.equal(r.status, 400)
    assertErroZod(r.body, "quant")
    const r2 = await api("POST", "/vendas", { clienteId: "1", discoId: 1, quant: 1 })
    assert.equal(r2.status, 400)
    assertErroZod(r2.body, "clienteId")
  })

  test("quantidade maior que o estoque -> 400 sem efeitos", async () => {
    const a = await snapshot(2, 1)
    const r = await api("POST", "/vendas", { clienteId: 2, discoId: 1, quant: a.estoque + 1 })
    assert.equal(r.status, 400)
    assert.deepEqual(await snapshot(2, 1), a)
  })

  test("não exclui cliente com compras (409)", async () => {
    assert.equal((await api("DELETE", "/clientes/1")).status, 409)
  })

  test("lista vendas inclui a venda criada", async () => {
    const r = await api("GET", "/vendas")
    assert.equal(r.status, 200)
    assert.ok(r.body.some((v: any) => v.id === vendaId))
  })

  test("DELETE /vendas/:id estorna estoque e totalGasto", async () => {
    const r = await api("DELETE", `/vendas/${vendaId}`)
    assert.equal(r.status, 200, r.text)
    assert.equal(r.body.disco.estoque, 1)
    const depois = await snapshot(1, 3)
    assert.equal(depois.estoque, 1)
    near(depois.totalGasto, antes.totalGasto)
    assert.equal(depois.vendas, antes.vendas)
  })

  test("DELETE repetido -> 404; id inválido -> 400", async () => {
    assert.equal((await api("DELETE", `/vendas/${vendaId}`)).status, 404)
    assert.equal((await api("DELETE", "/vendas/abc")).status, 400)
  })

  test("concorrência: 5 vendas paralelas de 1 exemplar -> só uma vence", async () => {
    const put = await api("PUT", "/discos/4", {
      titulo: "Migration", artista: "Bonobo", ano: 2017, preco: 199.9, estoque: 1, generoId: 2,
    })
    assert.equal(put.status, 200, put.text)

    const a = await snapshot(2, 4)
    const rs = await Promise.all(
      Array.from({ length: 5 }, () => api("POST", "/vendas", { clienteId: 2, discoId: 4, quant: 1 })),
    )
    const ok = rs.filter(r => r.status === 201)
    const ruins = rs.filter(r => r.status === 400)
    assert.equal(ok.length, 1, JSON.stringify(rs.map(r => r.status)))
    assert.equal(ruins.length, 4, JSON.stringify(rs.map(r => r.status)))

    const depois = await snapshot(2, 4)
    assert.equal(depois.estoque, 0)
    assert.equal(depois.vendas, a.vendas + 1)
    near(depois.totalGasto, a.totalGasto + a.preco)

    // limpeza: estorna a venda vencedora
    assert.equal((await api("DELETE", `/vendas/${ok[0].body.venda.id}`)).status, 200)
    assert.equal((await snapshot(2, 4)).estoque, 1)
  })
})
