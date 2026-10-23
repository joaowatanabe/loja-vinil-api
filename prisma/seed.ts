import { prisma } from "../lib/prisma"

// Os primeiros registros de cada tabela mantêm a ordem (e portanto os ids) usada
// pelos testes e pelo roteiro do Bruno: gênero 1 = House, disco 3 = Singularity
// com estoque 1, disco 4 = Migration, cliente 1 = ana@email.com, cliente 2 = bruno@email.com.

const generos = [
  "House", "Eletrônica", "Rock", "MPB",
  "Jazz", "Hip-Hop", "Soul", "Samba", "Pop", "Reggae",
]

// [titulo, artista, ano, preco, estoque, genero]
const discos: [string, string, number, number, number, string][] = [
  ["Discovery", "Daft Punk", 2001, 249.90, 5, "House"],
  ["Random Access Memories", "Daft Punk", 2013, 289.90, 4, "House"],
  ["Singularity", "Jon Hopkins", 2018, 219.90, 1, "Eletrônica"],
  ["Migration", "Bonobo", 2017, 199.90, 3, "Eletrônica"],
  ["OK Computer", "Radiohead", 1997, 259.90, 2, "Rock"],
  ["Clube da Esquina", "Milton Nascimento e Lô Borges", 1972, 239.90, 2, "MPB"],

  ["Homework", "Daft Punk", 1997, 229.90, 3, "House"],
  ["Settle", "Disclosure", 2013, 189.90, 6, "House"],
  ["Selected Ambient Works 85-92", "Aphex Twin", 1992, 279.90, 2, "Eletrônica"],
  ["Untrue", "Burial", 2007, 209.90, 0, "Eletrônica"],
  ["Kid A", "Radiohead", 2000, 249.90, 3, "Rock"],
  ["The Dark Side of the Moon", "Pink Floyd", 1973, 299.90, 7, "Rock"],
  ["Abbey Road", "The Beatles", 1969, 289.90, 4, "Rock"],
  ["Nevermind", "Nirvana", 1991, 229.90, 5, "Rock"],
  ["Elis & Tom", "Elis Regina e Tom Jobim", 1974, 249.90, 3, "MPB"],
  ["Construção", "Chico Buarque", 1971, 219.90, 2, "MPB"],
  ["Transa", "Caetano Veloso", 1972, 239.90, 0, "MPB"],
  ["Acabou Chorare", "Novos Baianos", 1972, 229.90, 4, "MPB"],
  ["Kind of Blue", "Miles Davis", 1959, 259.90, 6, "Jazz"],
  ["A Love Supreme", "John Coltrane", 1965, 269.90, 3, "Jazz"],
  ["Time Out", "The Dave Brubeck Quartet", 1959, 219.90, 2, "Jazz"],
  ["Sobrevivendo no Inferno", "Racionais MC's", 1997, 279.90, 5, "Hip-Hop"],
  ["To Pimp a Butterfly", "Kendrick Lamar", 2015, 309.90, 2, "Hip-Hop"],
  ["Illmatic", "Nas", 1994, 249.90, 1, "Hip-Hop"],
  ["What's Going On", "Marvin Gaye", 1971, 239.90, 4, "Soul"],
  ["Tim Maia Racional Vol. 1", "Tim Maia", 1975, 329.90, 1, "Soul"],
  ["Songs in the Key of Life", "Stevie Wonder", 1976, 319.90, 3, "Soul"],
  ["Cartola", "Cartola", 1976, 199.90, 3, "Samba"],
  ["Samba Esquema Novo", "Jorge Ben", 1963, 229.90, 2, "Samba"],
  ["Thriller", "Michael Jackson", 1982, 269.90, 8, "Pop"],
  ["Future Nostalgia", "Dua Lipa", 2020, 199.90, 5, "Pop"],
  ["Exodus", "Bob Marley & The Wailers", 1977, 239.90, 4, "Reggae"],
]

const clientes = [
  { nome: "Ana Souza", email: "ana@email.com" },
  { nome: "Bruno Lima", email: "bruno@email.com" },
  { nome: "Carla Mendes", email: "carla@email.com" },
  { nome: "Paula Tejando", email: "paula.tejando@email.com" },
  { nome: "Armando Bronca", email: "armando.bronca@email.com" },
  { nome: "Ana Konda", email: "ana.konda@email.com" },
  { nome: "Alan Brado", email: "alan.brado@email.com" },
  { nome: "Rui Doso", email: "rui.doso@email.com" },
  { nome: "Zé Vitrola", email: "ze.vitrola@email.com" },
  { nome: "Dona Agulha da Silva", email: "dona.agulha@email.com" },
  { nome: "Lado B Pereira", email: "ladob@email.com" },
  { nome: "Elvis Presto", email: "elvis.presto@email.com" },
  { nome: "Jorge Rotação 33 Júnior", email: "rotacao33@email.com" },
  { nome: "Faixa Bônus Oliveira", email: "faixa.bonus@email.com" },
]

// histórico de compras: [email do cliente, título do disco, quant, preço pago, data]
// alguns preços pagos são menores que o atual: o preço da venda fica congelado
const vendas: [string, string, number, number, string][] = [
  ["ana@email.com", "Discovery", 1, 229.90, "2026-03-14T15:20:00"],
  ["ana@email.com", "Kind of Blue", 1, 259.90, "2026-07-02T11:05:00"],
  ["bruno@email.com", "OK Computer", 1, 239.90, "2026-02-08T18:40:00"],
  ["bruno@email.com", "Sobrevivendo no Inferno", 1, 279.90, "2026-09-19T20:10:00"],
  ["carla@email.com", "Elis & Tom", 2, 249.90, "2026-05-11T10:30:00"],
  ["paula.tejando@email.com", "Thriller", 1, 259.90, "2026-01-21T14:00:00"],
  ["paula.tejando@email.com", "Future Nostalgia", 1, 199.90, "2026-08-30T16:45:00"],
  ["armando.bronca@email.com", "Nevermind", 1, 229.90, "2026-04-04T19:15:00"],
  ["armando.bronca@email.com", "To Pimp a Butterfly", 1, 299.90, "2026-06-13T21:00:00"],
  ["armando.bronca@email.com", "Illmatic", 1, 249.90, "2026-10-01T13:25:00"],
  ["ana.konda@email.com", "Exodus", 1, 239.90, "2026-03-27T09:50:00"],
  ["alan.brado@email.com", "The Dark Side of the Moon", 1, 289.90, "2026-02-15T17:30:00"],
  ["alan.brado@email.com", "Abbey Road", 1, 289.90, "2026-07-22T12:10:00"],
  ["rui.doso@email.com", "Selected Ambient Works 85-92", 1, 279.90, "2026-05-30T22:40:00"],
  ["ze.vitrola@email.com", "Cartola", 2, 189.90, "2026-01-09T10:00:00"],
  ["ze.vitrola@email.com", "Samba Esquema Novo", 1, 229.90, "2026-04-18T15:35:00"],
  ["ze.vitrola@email.com", "Acabou Chorare", 1, 219.90, "2026-08-05T11:20:00"],
  ["ze.vitrola@email.com", "Construção", 1, 219.90, "2026-10-12T16:00:00"],
  ["dona.agulha@email.com", "What's Going On", 1, 239.90, "2026-06-01T14:50:00"],
  ["dona.agulha@email.com", "Songs in the Key of Life", 1, 319.90, "2026-09-07T10:15:00"],
  ["ladob@email.com", "Untrue", 1, 199.90, "2026-03-03T23:05:00"],
  ["elvis.presto@email.com", "Time Out", 1, 219.90, "2026-05-20T18:00:00"],
  ["elvis.presto@email.com", "A Love Supreme", 1, 269.90, "2026-10-17T19:30:00"],
  ["rotacao33@email.com", "Homework", 1, 229.90, "2026-02-26T13:00:00"],
  ["rotacao33@email.com", "Settle", 2, 179.90, "2026-07-11T20:20:00"],
  ["rotacao33@email.com", "Transa", 1, 239.90, "2026-09-28T15:10:00"],
  // Faixa Bônus Oliveira ainda não comprou nada (pode ser excluído)
]

async function main() {
  // limpa na ordem inversa das chaves estrangeiras
  await prisma.venda.deleteMany()
  await prisma.disco.deleteMany()
  await prisma.genero.deleteMany()
  await prisma.cliente.deleteMany()

  // create em sequência para garantir a ordem dos ids
  const generoId: Record<string, number> = {}
  for (const nome of generos) {
    generoId[nome] = (await prisma.genero.create({ data: { nome } })).id
  }

  const discoId: Record<string, number> = {}
  for (const [titulo, artista, ano, preco, estoque, genero] of discos) {
    const d = await prisma.disco.create({
      data: { titulo, artista, ano, preco, estoque, generoId: generoId[genero] }
    })
    discoId[titulo] = d.id
  }

  const clienteId: Record<string, number> = {}
  for (const c of clientes) {
    clienteId[c.email] = (await prisma.cliente.create({ data: c })).id
  }

  await prisma.venda.createMany({
    data: vendas.map(([email, titulo, quant, preco, data]) => ({
      clienteId: clienteId[email],
      discoId: discoId[titulo],
      quant,
      preco,
      data: new Date(data),
    }))
  })

  // totalGasto = soma de preço × quant das vendas (em centavos para evitar erro de arredondamento)
  const centavos: Record<string, number> = {}
  for (const [email, , quant, preco] of vendas) {
    centavos[email] = (centavos[email] ?? 0) + Math.round(preco * 100) * quant
  }
  for (const [email, total] of Object.entries(centavos)) {
    await prisma.cliente.update({
      where: { id: clienteId[email] },
      data: { totalGasto: total / 100 }
    })
  }

  console.log(
    `Seed concluído: ${generos.length} gêneros, ${discos.length} discos, ` +
    `${clientes.length} clientes, ${vendas.length} vendas`
  )
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
