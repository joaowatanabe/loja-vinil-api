import { prisma } from "../../lib/prisma"
import { errosZod, idValido, trataErro } from "../../lib/erros"
import { Router } from "express"
import { z } from "zod"

const router = Router()

const generoSchema = z.object({
  nome: z.string()
    .min(3, "Nome do gênero deve possuir no mínimo 3 caracteres")
    .max(30, "Nome do gênero deve ter no máximo 30 caracteres"),
})

router.get("/", async (req, res) => {
  // #swagger.tags = ['Gêneros']
  try {
    const generos = await prisma.genero.findMany({
      include: { _count: { select: { discos: true } } },
      orderBy: { nome: "asc" }
    })
    res.status(200).json(generos)
  } catch (error) {
    trataErro(res, error)
  }
})

router.get("/:id", async (req, res) => {
  // #swagger.tags = ['Gêneros']
  const id = idValido(req.params.id)
  if (!id) {
    res.status(400).json({ erro: "Código inválido" })
    return
  }

  try {
    const genero = await prisma.genero.findUnique({
      where: { id },
      include: { discos: true }
    })
    if (!genero) {
      res.status(404).json({ erro: "Gênero não cadastrado" })
      return
    }
    res.status(200).json(genero)
  } catch (error) {
    trataErro(res, error)
  }
})

router.post("/", async (req, res) => {
  // #swagger.tags = ['Gêneros']
  const valida = generoSchema.safeParse(req.body)
  if (!valida.success) {
    res.status(400).json({ erros: errosZod(valida.error) })
    return
  }

  try {
    const genero = await prisma.genero.create({ data: valida.data })
    res.status(201).json(genero)
  } catch (error) {
    trataErro(res, error)
  }
})

router.put("/:id", async (req, res) => {
  // #swagger.tags = ['Gêneros']
  const id = idValido(req.params.id)
  if (!id) {
    res.status(400).json({ erro: "Código inválido" })
    return
  }

  const valida = generoSchema.safeParse(req.body)
  if (!valida.success) {
    res.status(400).json({ erros: errosZod(valida.error) })
    return
  }

  try {
    const genero = await prisma.genero.update({ where: { id }, data: valida.data })
    res.status(200).json(genero)
  } catch (error) {
    trataErro(res, error)
  }
})

router.delete("/:id", async (req, res) => {
  // #swagger.tags = ['Gêneros']
  const id = idValido(req.params.id)
  if (!id) {
    res.status(400).json({ erro: "Código inválido" })
    return
  }

  try {
    const genero = await prisma.genero.delete({ where: { id } })
    res.status(200).json(genero)
  } catch (error) {
    trataErro(res, error)      // 409 se ainda houver discos nesse gênero
  }
})

export default router
