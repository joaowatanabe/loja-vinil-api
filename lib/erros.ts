import { Response } from "express"
import { ZodError } from "zod"
import { Prisma } from "../generated/prisma/client"

// Erro "esperado" (regra de negócio): carrega o status HTTP que deve voltar.
// Lançado de dentro de uma transação, faz o Prisma dar ROLLBACK.
export class ErroApi extends Error {
  constructor(public status: number, mensagem: string) {
    super(mensagem)
  }
}

// Formato único para os erros de validação do Zod
export function errosZod(error: ZodError) {
  return error.issues.map(e => ({
    campo: e.path.join("."),
    mensagem: e.message,
  }))
}

// Converte o parâmetro :id em número (ou null se for inválido)
export function idValido(param: string) {
  const id = Number(param)
  return Number.isInteger(id) && id > 0 ? id : null
}

// Traduz qualquer erro em resposta HTTP: 4xx para casos conhecidos, 500 só para o inesperado
export function trataErro(res: Response, error: unknown) {
  if (error instanceof ErroApi) {
    res.status(error.status).json({ erro: error.message })
    return
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {      // registro não encontrado (update/delete)
      res.status(404).json({ erro: "Registro não encontrado" })
      return
    }
    if (error.code === "P2002") {      // valor único repetido (ex.: e-mail)
      res.status(409).json({ erro: "Já existe um registro com esse valor" })
      return
    }
    if (error.code === "P2003") {      // chave estrangeira (registro em uso ou id inexistente)
      res.status(409).json({ erro: "Registro relacionado: verifique os vínculos (em uso ou inexistente)" })
      return
    }
  }
  console.error(error)
  res.status(500).json({ erro: "Erro interno do servidor" })
}
