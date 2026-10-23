// swagger.ts (na raiz do projeto)
import swaggerAutogen from "swagger-autogen"

const doc = {
  info: {
    title: "API da Loja de Discos de Vinil",
    description: "Gêneros, discos, clientes e vendas (inclusão e exclusão de venda com transação) + e-mail com histórico de compras",
    version: "1.0.0",
  },
  servers: [{ url: "http://localhost:3000" }],
  tags: [
    { name: "Gêneros" },
    { name: "Discos" },
    { name: "Clientes" },
    { name: "Vendas", description: "Inclusão e exclusão são transações" },
  ],
}

const outputFile = "./swagger-output.json"
const routes = ["./src/server.ts"]   // só o arquivo que registra as rotas: ele segue os imports

swaggerAutogen({ openapi: "3.0.0" })(outputFile, routes, doc)
