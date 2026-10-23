import { prisma } from "../../lib/prisma"
import { ErroApi, errosZod, idValido, trataErro } from "../../lib/erros"
import { Router } from "express"
import { z } from "zod"

const router = Router()

const vendaSchema = z.object({
  clienteId: z.number().int().positive("ID do cliente deve ser um número positivo"),
  discoId: z.number().int().positive("ID do disco deve ser um número positivo"),
  quant: z.number().int().positive("Quantidade deve ser positiva"),
})

router.get("/", async (req, res) => {
  // #swagger.tags = ['Vendas']
  try {
    const vendas = await prisma.venda.findMany({
      include: {
        cliente: { select: { id: true, nome: true } },
        disco: { select: { id: true, titulo: true, artista: true } }
      },
      orderBy: { data: "desc" }
    })
    res.status(200).json(vendas)
  } catch (error) {
    trataErro(res, error)
  }
})

router.post("/", async (req, res) => {
  /*
    #swagger.tags = ['Vendas']
    #swagger.summary = 'Registra uma venda (transação)'
    #swagger.description = 'Em uma única transação: (1) baixa o estoque do disco, (2) cria a venda com o preço congelado do momento e (3) soma o valor no totalGasto do cliente. Se qualquer passo falhar (cliente/disco inexistente, estoque insuficiente), é feito ROLLBACK e nada muda no banco.'
    #swagger.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["clienteId", "discoId", "quant"],
            properties: {
              clienteId: { type: "integer", example: 1, description: "Código do cliente" },
              discoId: { type: "integer", example: 2, description: "Código do disco" },
              quant: { type: "integer", example: 1, minimum: 1, description: "Quantidade de cópias" }
            }
          }
        }
      }
    }
    #swagger.responses[201] = {
      description: 'Venda registrada; retorna a venda, o disco com o estoque novo e o cliente com o total atualizado',
      content: {
        "application/json": {
          example: {
            venda: { id: 7, clienteId: 1, discoId: 2, quant: 1, preco: "289.9", data: "2026-10-23T22:10:00.000Z" },
            disco: { id: 2, titulo: "Random Access Memories", estoque: 3 },
            cliente: { id: 1, nome: "Ana Souza", totalGasto: "579.8" }
          }
        }
      }
    }
    #swagger.responses[400] = {
      description: 'Dados inválidos (Zod) ou estoque insuficiente',
      content: { "application/json": { example: { erro: "Estoque insuficiente: há apenas 0 cópia(s) de Random Access Memories" } } }
    }
    #swagger.responses[404] = {
      description: 'Cliente ou disco não cadastrado',
      content: { "application/json": { example: { erro: "Disco não cadastrado" } } }
    }
  */
  const valida = vendaSchema.safeParse(req.body)
  if (!valida.success) {
    res.status(400).json({ erros: errosZod(valida.error) })
    return
  }

  const { clienteId, discoId, quant } = valida.data

  try {
    // Transação interativa: qualquer throw aqui dentro desfaz tudo (ROLLBACK)
    const resultado = await prisma.$transaction(async (tx) => {
      const cliente = await tx.cliente.findUnique({ where: { id: clienteId } })
      if (!cliente) throw new ErroApi(404, "Cliente não cadastrado")

      const disco = await tx.disco.findUnique({ where: { id: discoId } })
      if (!disco) throw new ErroApi(404, "Disco não cadastrado")

      // Baixa condicional: só atualiza se ainda houver estoque suficiente.
      // Evita estoque negativo mesmo com duas vendas ao mesmo tempo.
      const baixa = await tx.disco.updateMany({
        where: { id: discoId, estoque: { gte: quant } },
        data: { estoque: { decrement: quant } }
      })
      if (baixa.count === 0) {
        throw new ErroApi(400, `Estoque insuficiente: há apenas ${disco.estoque} cópia(s) de ${disco.titulo}`)
      }

      // Preço congelado: guarda o preço do momento da venda
      const venda = await tx.venda.create({
        data: { clienteId, discoId, quant, preco: disco.preco }
      })

      const clienteAtualizado = await tx.cliente.update({
        where: { id: clienteId },
        data: { totalGasto: { increment: disco.preco.mul(quant) } }
      })

      const discoAtualizado = await tx.disco.findUniqueOrThrow({
        where: { id: discoId },
        select: { id: true, titulo: true, estoque: true }
      })

      return { venda, disco: discoAtualizado, cliente: clienteAtualizado }
    })

    res.status(201).json(resultado)
  } catch (error) {
    trataErro(res, error)
  }
})

router.delete("/:id", async (req, res) => {
  /*
    #swagger.tags = ['Vendas']
    #swagger.summary = 'Estorna uma venda (transação)'
    #swagger.description = 'Em uma única transação: apaga a venda, devolve as cópias ao estoque do disco e subtrai o valor do totalGasto do cliente.'
  */
  const id = idValido(req.params.id)
  if (!id) {
    res.status(400).json({ erro: "Código inválido" })
    return
  }

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const venda = await tx.venda.findUnique({ where: { id } })
      if (!venda) throw new ErroApi(404, "Venda não encontrada")

      await tx.venda.delete({ where: { id } })

      const disco = await tx.disco.update({
        where: { id: venda.discoId },
        data: { estoque: { increment: venda.quant } },
        select: { id: true, titulo: true, estoque: true }
      })

      const cliente = await tx.cliente.update({
        where: { id: venda.clienteId },
        data: { totalGasto: { decrement: venda.preco.mul(venda.quant) } }
      })

      return { vendaExcluida: venda, disco, cliente }
    })

    res.status(200).json(resultado)
  } catch (error) {
    trataErro(res, error)
  }
})

export default router
