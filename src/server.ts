import express from "express"
const app = express()
const port = 3000

import routesGeneros from "./routes/generos"
import routesDiscos from "./routes/discos"
import routesClientes from "./routes/clientes"
import routesVendas from "./routes/vendas"

app.use(express.json())

app.use("/generos", routesGeneros)
app.use("/discos", routesDiscos)
app.use("/clientes", routesClientes)
app.use("/vendas", routesVendas)

app.get("/", (req, res) => {
  res.send("API: Loja de Discos de Vinil - documentação em /docs")
})

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port} - docs em http://localhost:${port}/docs`)
})
