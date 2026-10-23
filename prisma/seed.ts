import { prisma } from "../lib/prisma"

async function main() {
  // limpa na ordem inversa das chaves estrangeiras
  await prisma.venda.deleteMany()
  await prisma.disco.deleteMany()
  await prisma.genero.deleteMany()
  await prisma.cliente.deleteMany()

  const house = await prisma.genero.create({ data: { nome: "House" } })
  const eletronica = await prisma.genero.create({ data: { nome: "Eletrônica" } })
  const rock = await prisma.genero.create({ data: { nome: "Rock" } })
  const mpb = await prisma.genero.create({ data: { nome: "MPB" } })

  await prisma.disco.createMany({
    data: [
      { titulo: "Discovery", artista: "Daft Punk", ano: 2001, preco: 249.90, estoque: 5, generoId: house.id },
      { titulo: "Random Access Memories", artista: "Daft Punk", ano: 2013, preco: 289.90, estoque: 4, generoId: house.id },
      { titulo: "Singularity", artista: "Jon Hopkins", ano: 2018, preco: 219.90, estoque: 1, generoId: eletronica.id },
      { titulo: "Migration", artista: "Bonobo", ano: 2017, preco: 199.90, estoque: 3, generoId: eletronica.id },
      { titulo: "OK Computer", artista: "Radiohead", ano: 1997, preco: 259.90, estoque: 2, generoId: rock.id },
      { titulo: "Clube da Esquina", artista: "Milton Nascimento e Lô Borges", ano: 1972, preco: 239.90, estoque: 2, generoId: mpb.id },
    ]
  })

  await prisma.cliente.createMany({
    data: [
      { nome: "Ana Souza", email: "ana@email.com" },
      { nome: "Bruno Lima", email: "bruno@email.com" },
      { nome: "Carla Mendes", email: "carla@email.com" },
    ]
  })

  console.log("Seed concluído: 4 gêneros, 6 discos, 3 clientes")
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
