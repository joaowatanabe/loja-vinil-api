# API da Loja de Discos de Vinil

API REST para gerenciar uma loja de discos de vinil: **gêneros**, **discos**, **clientes** e **vendas**. O destaque é o registro e o estorno de vendas feitos com **transação** (estoque, venda e total gasto do cliente sempre andam juntos), além de uma rota que **envia por e-mail o histórico de compras** do cliente e da documentação interativa em **Swagger** (`/docs`).

Trabalho #2 de *Desenvolvimento de Serviços e APIs* — SENAC, ADS, 3º semestre. Prof. Edécio Fernando Iepsen. Trabalho individual, apresentado em 23/10/2026.

**Stack:** Node.js + TypeScript (tsx) · Express 5 · Prisma 7 (gerador `prisma-client`, adapter MariaDB) · MySQL 8 · Zod 4 · Nodemailer + Mailtrap (sandbox) · swagger-autogen + swagger-ui-express · testes manuais no Bruno e 33 testes automatizados com `node:test`.

---

## 1. O que o trabalho pede e como foi atendido

- [x] **0. Proposta com diagrama E-R** — tema Loja de Discos de Vinil; diagrama na seção [Modelo de dados](#2-modelo-de-dados).
- [x] **1. Projeto, `.env`, schema e migration** — projeto Node/TS, variáveis em `.env`, `prisma/schema.prisma` e migration em `prisma/migrations` (`npx prisma migrate dev`). Seed com dados de exemplo em `prisma/seed.ts`.
- [x] **2. CRUD das tabelas básicas, testado no Bruno** — `/generos`, `/discos` e `/clientes` com GET (lista e por id), POST, PUT e DELETE, validados com Zod. Coleção na pasta `bruno/`.
- [x] **3. Incluir e listar na tabela da transação** — `POST /vendas` (inclusão transacional) e `GET /vendas` (lista com cliente e disco).
- [x] **4. Excluir com transação** — `DELETE /vendas/:id` estorna a venda: devolve o estoque e abate o total gasto do cliente.
- [x] **5. Rota que envia e-mail com o histórico de ações do cliente** — `GET /clientes/email/:id` envia uma tabela HTML com todas as compras do cliente (via Mailtrap sandbox).
- [x] **6. Swagger com uma rota de inclusão detalhada** — `POST /vendas` documentada com resumo, descrição, corpo da requisição e exemplos de resposta 201/400/404, em `http://localhost:3000/docs`.

---

## 2. Modelo de dados

```mermaid
erDiagram
    GENERO ||--o{ DISCO : "classifica"
    DISCO ||--o{ VENDA : "é vendido em"
    CLIENTE ||--o{ VENDA : "realiza"

    GENERO {
        int id PK
        string nome UK "VarChar(30)"
    }
    DISCO {
        int id PK
        string titulo "VarChar(60)"
        string artista "VarChar(60)"
        smallint ano
        decimal preco "9,2"
        smallint estoque "default 0"
        int generoId FK
    }
    CLIENTE {
        int id PK
        string nome "VarChar(40)"
        string email UK "VarChar(60)"
        decimal totalGasto "10,2 - default 0"
    }
    VENDA {
        int id PK
        int clienteId FK
        int discoId FK
        smallint quant
        decimal preco "preço congelado"
        datetime data "default now()"
    }
```

| Tabela | Papel |
|---|---|
| `generos` | Categorias musicais. Nome único. |
| `discos` | Catálogo, com preço atual e **estoque**. Pertence a um gênero. |
| `clientes` | Compradores. E-mail único; `totalGasto` é um acumulado mantido pela transação de venda. |
| `vendas` | **Tabela da transação.** Liga cliente e disco e guarda a quantidade e o **preço no momento da compra** (mudar o preço do disco depois não altera vendas antigas). |

---

## 3. A transação

### `POST /vendas` — registrar venda

Corpo: `{ "clienteId": 1, "discoId": 2, "quant": 1 }`. Tudo roda dentro de um `prisma.$transaction` interativo:

1. Busca o **cliente** e o **disco**; se algum não existir, lança erro **404**.
2. **Baixa condicional de estoque**: `updateMany` com `where: { id, estoque: { gte: quant } }` e `decrement`. Se nenhuma linha foi alterada, não havia estoque suficiente e a API devolve **400**. Como a checagem e a baixa são **uma única instrução atômica**, o estoque nunca fica negativo, nem com duas vendas simultâneas do último exemplar.
3. Cria a **venda** com o preço **congelado** (`disco.preco`).
4. **Incrementa** `cliente.totalGasto` em `preco × quant`.

Qualquer erro lançado dentro da transação causa **ROLLBACK**: nada do que foi feito antes permanece no banco.

Exemplo de resposta (**201**) com o seed recém-carregado:

```json
{
  "venda":   { "id": 27, "clienteId": 1, "discoId": 1, "quant": 1, "preco": "249.9", "data": "2026-10-23T18:46:29.736Z" },
  "disco":   { "id": 1, "titulo": "Discovery", "estoque": 4 },
  "cliente": { "id": 1, "nome": "Ana Souza", "email": "ana@email.com", "totalGasto": "739.7" }
}
```

Repetindo a venda de um disco sem estoque, a resposta é **400** e nenhuma tabela muda:

```json
{ "erro": "Estoque insuficiente: há apenas 0 cópia(s) de Singularity" }
```

### `DELETE /vendas/:id` — estornar venda

Também em transação, o caminho inverso: busca a venda (404 se não existir), apaga, **devolve** `quant` ao estoque do disco e **subtrai** `preco × quant` do `totalGasto` do cliente.

### O que daria errado sem transação

- Estoque baixado, mas a criação da venda falha: o disco "some" sem venda registrada.
- Venda criada, mas o `totalGasto` não atualiza (queda de conexão, erro): dados inconsistentes entre tabelas.
- Duas vendas ao mesmo tempo do último exemplar: ambas leem `estoque = 1` e passam, e o estoque vai a `-1`.
- Estorno pela metade: a venda é apagada mas o estoque não volta (ou o contrário).

Com a transação, ou **tudo acontece** ou **nada acontece**.

```mermaid
sequenceDiagram
    participant C as Cliente HTTP
    participant A as API (Express + Zod)
    participant DB as MySQL (transação)

    C->>A: POST /vendas {clienteId, discoId, quant}
    A->>A: Valida corpo com Zod (400 se inválido)
    A->>DB: BEGIN
    A->>DB: SELECT cliente / disco
    alt cliente ou disco não existe
        DB-->>A: vazio
        A->>DB: ROLLBACK
        A-->>C: 404
    else existe
        A->>DB: UPDATE discos SET estoque = estoque - quant WHERE id AND estoque >= quant
        alt 0 linhas afetadas (sem estoque)
            A->>DB: ROLLBACK
            A-->>C: 400 Estoque insuficiente
        else baixa feita
            A->>DB: INSERT venda (preço congelado)
            A->>DB: UPDATE cliente SET totalGasto = totalGasto + preço*quant
            A->>DB: COMMIT
            A-->>C: 201 {venda, disco, cliente}
        end
    end
```

---

## 4. Endpoints

| Método | Rota | Descrição | Status principais |
|---|---|---|---|
| GET | `/generos` | Lista gêneros | 200 |
| GET | `/generos/:id` | Busca um gênero | 200, 400, 404 |
| POST | `/generos` | Cria gênero | 201, 400, 409 |
| PUT | `/generos/:id` | Atualiza gênero | 200, 400, 404, 409 |
| DELETE | `/generos/:id` | Exclui gênero | 200, 400, 404, 409 (tem discos) |
| GET | `/discos` | Lista discos | 200 |
| GET | `/discos/:id` | Busca um disco | 200, 400, 404 |
| POST | `/discos` | Cria disco | 201, 400, 409 (gênero inexistente) |
| PUT | `/discos/:id` | Atualiza disco | 200, 400, 404, 409 |
| DELETE | `/discos/:id` | Exclui disco | 200, 400, 404, 409 (tem vendas) |
| GET | `/clientes` | Lista clientes | 200 |
| GET | `/clientes/:id` | Busca um cliente | 200, 400, 404 |
| POST | `/clientes` | Cria cliente | 201, 400, 409 (e-mail repetido) |
| PUT | `/clientes/:id` | Atualiza cliente | 200, 400, 404, 409 |
| DELETE | `/clientes/:id` | Exclui cliente | 200, 400, 404, 409 (tem compras) |
| GET | `/clientes/email/:id` | Envia por e-mail o histórico de compras | 200, 400, 404, 502 (servidor SMTP recusou) |
| GET | `/vendas` | Lista vendas (com cliente e disco), mais recentes primeiro | 200 |
| POST | `/vendas` | **Transação:** registra venda | 201, 400, 404 |
| DELETE | `/vendas/:id` | **Transação:** estorna venda | 200, 400, 404 |
| GET | `/docs` | Swagger UI | 200 |

---

## 5. Tratamento de erros

Centralizado em `lib/erros.ts` (função `trataErro`):

| Status | Quando | Formato |
|---|---|---|
| **400** | Validação Zod falhou, `:id` inválido ou estoque insuficiente | `{ "erros": [{ "campo": "quant", "mensagem": "Quantidade deve ser positiva" }] }` ou `{ "erro": "..." }` |
| **404** | Registro, cliente, disco ou venda não encontrado (inclui Prisma `P2025`) | `{ "erro": "Disco não cadastrado" }` |
| **409** | Conflito: valor único repetido (`P2002`, ex.: e-mail) ou chave estrangeira (`P2003`, ex.: excluir gênero com discos) | `{ "erro": "..." }` |
| **502** | O servidor de e-mail (SMTP) recusou o envio — ex.: o Mailtrap grátis aceita no máximo ~1 e-mail por segundo | `{ "erro": "Falha ao enviar o e-mail: 550 5.7.0 Too many emails per second..." }` |
| **500** | Somente erros **inesperados** (logados no console) | `{ "erro": "Erro interno do servidor" }` |

Regras de negócio dentro de transações usam a classe `ErroApi(status, mensagem)`: ao ser lançada, faz o ROLLBACK e já carrega o status HTTP correto.

---

## 6. Como rodar

**Pré-requisitos:** Node.js 20.19+ (testado no 24), MySQL 8 rodando localmente, conta gratuita no [Mailtrap](https://mailtrap.io) (Email Testing / sandbox) e o app [Bruno](https://www.usebruno.com).

```bash
# 1. dependências (o postinstall já roda `prisma generate`)
npm install
```

**2. Crie o arquivo `.env`** na raiz (nunca versionar) — apenas exemplo com valores fictícios:

```env
DATABASE_URL="mysql://usuario:senha@localhost:3306/loja_vinil"
DATABASE_USER="usuario"
DATABASE_PASSWORD="senha"
DATABASE_NAME="loja_vinil"
DATABASE_HOST="localhost"
DATABASE_PORT=3306

# Credenciais SMTP do Mailtrap (sandbox)
SMTP_USER="seu_usuario_mailtrap"
SMTP_PASS="sua_senha_mailtrap"
```

> `DATABASE_URL` é usada pelo Prisma CLI (migrations/seed); as demais variáveis são usadas pelo adapter MariaDB em `lib/prisma.ts`.

```bash
# 3. cria o banco e aplica a migration (prisma/migrations)
npx prisma migrate dev

# 4. popula com 10 gêneros, 32 discos, 14 clientes e 26 vendas
npx prisma db seed

# 5. gera o swagger-output.json
npm run swagger

# 6. sobe a API em modo watch
npm run dev
```

**Testes automatizados** (33 testes com `node:test` + `fetch`, API rodando em outro terminal):

```bash
npm run reset   # recria o banco e roda o seed (apaga tudo!)
npm test
```

> **Prisma 7:** o `migrate reset` não roda mais o seed sozinho, por isso o script `reset` é `prisma migrate reset --force && prisma db seed`. Rodar só `npx prisma db seed` de novo recria os dados, mas **não volta os ids para 1** (o auto-increment continua), e a pasta Demo do Bruno depende desses ids. Para voltar ao estado inicial, use sempre `npm run reset`.

Abra **http://localhost:3000/docs** para a documentação. A API responde em `http://localhost:3000`.

### Coleção do Bruno (34 requisições)

Abra a pasta `bruno/` pelo app (*Open Collection*) e selecione o environment **Local** (`baseUrl = http://localhost:3000`). Se o Bruno mostrar `ECONNREFUSED`, a API não está rodando: deixe o `npm run dev` aberto em um terminal.

| Pasta | O que tem |
|---|---|
| `Generos`, `Discos`, `Clientes` | CRUD **autocontido**: o *Incluir* cria um registro com sufixo único e guarda o id (`bru.setVar`), e *Buscar*, *Alterar* e *Excluir* usam **esse** registro. No fim, requisições **409 de propósito**: gênero repetido e exclusão de gênero/disco/cliente em uso. |
| `Clientes` | Também *Enviar e-mail histórico*. |
| `Vendas` | Listar, incluir e estornar (usa o id da venda criada). |
| `Demo` | Roteiro da apresentação, de 01 a 11 (ver seção 7). Termina com o estorno, então pode ser rodada de novo. |

O Mailtrap grátis recusa e-mails muito seguidos (`550 Too many emails per second`, e a API devolve 502). Por isso as requisições de e-mail só esperam se outro e-mail saiu há menos de 11 s. Um envio isolado sai na hora.

A coleção inteira também roda pelo terminal (34/34):

```bash
cd bruno && npx @usebruno/cli run --env Local -r
```

---

## 7. Roteiro de demonstração

**Antes de começar:** MySQL ligado → `npm run reset` → `npm run dev` (deixar aberto) → Bruno com o environment **Local** → abas abertas: caixa do Mailtrap, `http://localhost:3000/docs` e o repositório no GitHub.

1. **Diagrama E-R:** mostrar a seção 2 e explicar as relações 1:N.
2. **CRUD rápido (Bruno, pasta `Generos`):** *Incluir gênero* (201), *Incluir gênero repetido* (409) e *Excluir gênero em uso* (409), para mostrar o tratamento de erros.
3. **Pasta `Demo`, uma requisição por vez:**

| # | Requisição | O que aparece |
|---|---|---|
| 01 | Ver disco 3 | Singularity com `estoque: 1` |
| 02 | Ver cliente 2 | `totalGasto` antes da venda |
| 03 | Venda OK | **201** com a venda, o disco (`estoque: 0`) e o cliente com o total maior |
| 04 | Ver disco 3 de novo | `estoque: 0` |
| 05 | Venda sem estoque | **400** "Estoque insuficiente" (ROLLBACK, nada muda) |
| 06 | Ver cliente 2 | `totalGasto` só com a venda que deu certo |
| 07 | Listar vendas | a venda nova no topo |
| 08 | Estornar venda | **200**, estoque devolvido e total abatido (transação) |
| 09 | Ver disco 3 | `estoque: 1` de novo |
| 10 | Validação Zod | **400** com `{ erros: [{ campo, mensagem }] }` |
| 11 | Enviar e-mail | **200**; abrir o Mailtrap e mostrar a tabela de compras |

4. **Swagger:** em `/docs`, abrir `POST /vendas`, mostrar a descrição e os exemplos e usar **Try it out**.
5. **GitHub:** uma branch e um PR por item do enunciado, mais os testes (33 e2e e Bruno 34/34).

Se der errado: `ECONNREFUSED` → `npm run dev`; 404 em tudo ou a Demo 05 não dá 400 → `npm run reset`; e-mail **502** → esperar ~10 s e reenviar.

---

## 8. Estrutura de pastas

```
loja-vinil-api/
├── bruno/                  # coleção de testes do Bruno
├── generated/prisma/       # client gerado pelo Prisma (não editar)
├── lib/
│   ├── prisma.ts           # PrismaClient com adapter MariaDB
│   └── erros.ts            # ErroApi, errosZod, idValido, trataErro
├── prisma/
│   ├── schema.prisma       # modelos Genero, Disco, Cliente, Venda
│   ├── migrations/         # histórico de migrations
│   └── seed.ts             # dados de exemplo
├── src/
│   ├── server.ts           # app Express, rotas e /docs
│   └── routes/             # generos.ts, discos.ts, clientes.ts, vendas.ts
├── tests/
│   └── api.test.ts         # 33 testes end-to-end (node:test + fetch)
├── prisma.config.ts        # config do Prisma 7 (schema, migrations, seed)
├── swagger.ts              # gerador do swagger-output.json
├── swagger-output.json     # documentação OpenAPI gerada (servida em /docs)
├── .env                    # variáveis locais (fora do Git)
└── package.json
```

---

## 9. Fluxo de Git

`main` contém a versão final. O trabalho foi desenvolvido em uma branch por item do enunciado, cada uma integrada via Pull Request (na ordem abaixo, já que cada branch parte da anterior):

| PR | Branch | Conteúdo |
|---|---|---|
| #1 | `feat/schema-crud` | Itens 1 e 2: schema, migration, seed e CRUD básico |
| #2 | `feat/transacao-vendas` | Itens 3 e 4: inclusão, listagem e estorno de vendas com transação |
| #3 | `feat/email` | Item 5: rota de e-mail com histórico de compras |
| #4 | `feat/swagger` | Item 6: documentação Swagger |
| #5 | `docs/readme-bruno` | README e coleção do Bruno |
| #6 | `test/e2e` | 33 testes end-to-end |

Depois disso, cada correção também virou branch + PR a partir da `main`:

| PR | Branch | Conteúdo |
|---|---|---|
| #7 | `fix/reset-seed` | `npm run reset` passa a rodar o seed (Prisma 7) |
| #8 | `feat/seed-rico` | Seed com 10 gêneros, 32 discos, 14 clientes e 26 vendas |
| #9 | `fix/bruno-demo-email` | E-mail devolve 502 quando o SMTP recusa; coleção do Bruno autocontida (34/34) |

---

## 10. Autor

**João Vicente Watanabe** — GitHub: [@joaowatanabe](https://github.com/joaowatanabe)
SENAC · Análise e Desenvolvimento de Sistemas · 3º semestre
