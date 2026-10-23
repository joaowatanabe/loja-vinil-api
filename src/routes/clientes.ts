import { prisma } from "../../lib/prisma"
import { errosZod, idValido, trataErro } from "../../lib/erros"
import { Router } from "express"
import { z } from "zod"
import nodemailer from "nodemailer"

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

// ---------------------------------------------------------------
// E-mail com o histórico de compras do cliente
// ---------------------------------------------------------------

const moeda = (valor: number) =>
  valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const dataHora = (data: Date) =>
  data.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  })

type ClienteComVendas = NonNullable<Awaited<ReturnType<typeof buscaClienteComVendas>>>

function buscaClienteComVendas(id: number) {
  return prisma.cliente.findUnique({
    where: { id },
    include: {
      vendas: {
        include: { disco: true },
        orderBy: { data: "asc" }
      }
    }
  })
}

function gerarTabelaHTML(cliente: ClienteComVendas) {
  let total = 0
  let linhas = ""

  for (const venda of cliente.vendas) {
    const subtotal = venda.quant * Number(venda.preco)
    total += subtotal
    linhas += `
      <tr>
        <td>${dataHora(venda.data)}</td>
        <td>${venda.disco.artista} - ${venda.disco.titulo} (${venda.disco.ano})</td>
        <td style="text-align: center;">${venda.quant}</td>
        <td style="text-align: right;">${moeda(Number(venda.preco))}</td>
        <td style="text-align: right;">${moeda(subtotal)}</td>
      </tr>`
  }

  if (cliente.vendas.length === 0) {
    linhas = `<tr><td colspan="5" style="text-align: center;">Nenhuma compra registrada</td></tr>`
  }

  return `
    <html>
    <body style="font-family: Helvetica, Arial, sans-serif;">
      <h2>Loja de Discos de Vinil: Histórico de Compras</h2>
      <h3>Cliente: ${cliente.nome}</h3>
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">
        <thead style="background-color: rgb(195, 191, 191);">
          <tr>
            <th>Data e Hora</th>
            <th>Disco</th>
            <th>Quant.</th>
            <th>Preço R$</th>
            <th>Subtotal R$</th>
          </tr>
        </thead>
        <tbody>
          ${linhas}
          <tr style="font-weight: bold; background-color: rgb(235, 232, 232);">
            <td colspan="4" style="text-align: right;">Total gasto:</td>
            <td style="text-align: right;">R$ ${moeda(total)}</td>
          </tr>
        </tbody>
      </table>
      <p>Obrigado por comprar com a gente! 🎶</p>
    </body>
    </html>
  `
}

const transporter = nodemailer.createTransport({
  host: "sandbox.smtp.mailtrap.io",
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
})

router.get("/email/:id", async (req, res) => {
  // #swagger.tags = ['Clientes']
  // #swagger.summary = 'Envia ao cliente, por e-mail, o histórico das compras dele'
  const id = idValido(req.params.id)
  if (!id) {
    res.status(400).json({ erro: "Código inválido" })
    return
  }

  try {
    const cliente = await buscaClienteComVendas(id)
    if (!cliente) {
      res.status(404).json({ erro: "Cliente não cadastrado" })
      return
    }

    const info = await transporter.sendMail({
      from: "Loja de Discos de Vinil <loja@vinil.com>",
      to: cliente.email,
      subject: "Seu histórico de compras - Loja de Discos de Vinil",
      text: `Olá, ${cliente.nome}! Você tem ${cliente.vendas.length} compra(s) registrada(s).`,
      html: gerarTabelaHTML(cliente),
    })

    res.status(200).json({ mensagem: `E-mail enviado para ${cliente.email}`, id: info.messageId })
  } catch (error) {
    trataErro(res, error)
  }
})

export default router
