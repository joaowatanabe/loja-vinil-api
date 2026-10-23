import { prisma } from "../../lib/prisma"
import { errosZod, idValido, trataErro } from "../../lib/erros"
import { Router } from "express"
import { z } from "zod"

const router = Router()

// totalGasto não entra no schema: só muda pelas transações de venda
const clienteSchema = z.object({
  nome: z.string()
    .min(3, "Nome deve possuir no mínimo 3 caracteres")
    .max(40, "Nome deve ter no máximo 40 caracteres"),
  email: z.email("E-mail inválido").max(60, "E-mail deve ter no máximo 60 caracteres"),
})

router.get("/", async (req, res) => {
  // #swagger.tags = ['Clientes']
  try {
    const clientes = await prisma.cliente.findMany({ orderBy: { nome: "asc" } })
    res.status(200).json(clientes)
  } catch (error) {
    trataErro(res, error)
  }
})

router.get("/:id", async (req, res) => {
  // #swagger.tags = ['Clientes']
  const id = idValido(req.params.id)
  if (!id) {
    res.status(400).json({ erro: "Código inválido" })
    return
  }

  try {
    const cliente = await prisma.cliente.findUnique({
      where: { id },
      include: { vendas: { include: { disco: true } } }
    })
    if (!cliente) {
      res.status(404).json({ erro: "Cliente não cadastrado" })
      return
    }
    res.status(200).json(cliente)
  } catch (error) {
    trataErro(res, error)
  }
})

router.post("/", async (req, res) => {
  // #swagger.tags = ['Clientes']
  const valida = clienteSchema.safeParse(req.body)
  if (!valida.success) {
    res.status(400).json({ erros: errosZod(valida.error) })
    return
  }

  try {
    const cliente = await prisma.cliente.create({ data: valida.data })
    res.status(201).json(cliente)
  } catch (error) {
    trataErro(res, error)      // 409 se o e-mail já existir
  }
})

router.put("/:id", async (req, res) => {
  // #swagger.tags = ['Clientes']
  const id = idValido(req.params.id)
  if (!id) {
    res.status(400).json({ erro: "Código inválido" })
    return
  }

  const valida = clienteSchema.safeParse(req.body)
  if (!valida.success) {
    res.status(400).json({ erros: errosZod(valida.error) })
    return
  }

  try {
    const cliente = await prisma.cliente.update({ where: { id }, data: valida.data })
    res.status(200).json(cliente)
  } catch (error) {
    trataErro(res, error)
  }
})

router.delete("/:id", async (req, res) => {
  // #swagger.tags = ['Clientes']
  const id = idValido(req.params.id)
  if (!id) {
    res.status(400).json({ erro: "Código inválido" })
    return
  }

  try {
    const cliente = await prisma.cliente.delete({ where: { id } })
    res.status(200).json(cliente)
  } catch (error) {
    trataErro(res, error)      // 409 se o cliente já tiver compras
  }
})

export default router
