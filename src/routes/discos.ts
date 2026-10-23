import { prisma } from "../../lib/prisma"
import { errosZod, idValido, trataErro } from "../../lib/erros"
import { Router } from "express"
import { z } from "zod"

const router = Router()

const discoSchema = z.object({
  titulo: z.string()
    .min(1, "Título é obrigatório")
    .max(60, "Título deve ter no máximo 60 caracteres"),
  artista: z.string()
    .min(2, "Artista deve possuir no mínimo 2 caracteres")
    .max(60, "Artista deve ter no máximo 60 caracteres"),
  ano: z.number().int()
    .min(1948, "O LP de vinil surgiu em 1948")
    .max(new Date().getFullYear(), "Ano não pode estar no futuro"),
  preco: z.number().positive("Preço deve ser um valor positivo"),
  estoque: z.number().int().min(0, "Estoque não pode ser negativo"),
  generoId: z.number().int().positive("ID do gênero deve ser um número positivo"),
})

router.get("/", async (req, res) => {
  // #swagger.tags = ['Discos']
  try {
    const discos = await prisma.disco.findMany({
      include: { genero: true },
      orderBy: { artista: "asc" }
    })
    res.status(200).json(discos)
  } catch (error) {
    trataErro(res, error)
  }
})

router.get("/:id", async (req, res) => {
  // #swagger.tags = ['Discos']
  const id = idValido(req.params.id)
  if (!id) {
    res.status(400).json({ erro: "Código inválido" })
    return
  }

  try {
    const disco = await prisma.disco.findUnique({
      where: { id },
      include: { genero: true }
    })
    if (!disco) {
      res.status(404).json({ erro: "Disco não cadastrado" })
      return
    }
    res.status(200).json(disco)
  } catch (error) {
    trataErro(res, error)
  }
})

router.post("/", async (req, res) => {
  // #swagger.tags = ['Discos']
  const valida = discoSchema.safeParse(req.body)
  if (!valida.success) {
    res.status(400).json({ erros: errosZod(valida.error) })
    return
  }

  try {
    const disco = await prisma.disco.create({ data: valida.data })
    res.status(201).json(disco)
  } catch (error) {
    trataErro(res, error)      // 409 se o generoId não existir
  }
})

router.put("/:id", async (req, res) => {
  // #swagger.tags = ['Discos']
  const id = idValido(req.params.id)
  if (!id) {
    res.status(400).json({ erro: "Código inválido" })
    return
  }

  const valida = discoSchema.safeParse(req.body)
  if (!valida.success) {
    res.status(400).json({ erros: errosZod(valida.error) })
    return
  }

  try {
    const disco = await prisma.disco.update({ where: { id }, data: valida.data })
    res.status(200).json(disco)
  } catch (error) {
    trataErro(res, error)
  }
})

router.delete("/:id", async (req, res) => {
  // #swagger.tags = ['Discos']
  const id = idValido(req.params.id)
  if (!id) {
    res.status(400).json({ erro: "Código inválido" })
    return
  }

  try {
    const disco = await prisma.disco.delete({ where: { id } })
    res.status(200).json(disco)
  } catch (error) {
    trataErro(res, error)      // 409 se o disco já tiver vendas
  }
})

export default router
