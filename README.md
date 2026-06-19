# Lexi Webhook PoC
PoC de um serviço de webhook não-bloqueante para a Lexi, agente de negociação da Arbitralis. 
## Tecnologias
- **Node.js** v20+
- **TypeScript** 5.3
- **Express** 4.18
- **Vitest** 1.2
- **tsx** — execução TypeScript em desenvolvimento
- **uuid** — geração de correlationId único por job
- **supertest** — requisições HTTP nos testes
## O Problema
O webhook da Meta (WhatsApp) aguarda resposta na mesma conexão HTTP. Quando o LLM ficou lento, a Meta deu timeout e mensagens foram perdidas no meio de negociações.
## A Solução
Desacoplar o recebimento do processamento: o endpoint retorna **202 Accepted** para a Meta em milissegundos e processa o LLM em background via fila em memória.
```
POST /webhook
     │
     ├─► valida payload
     ├─► gera correlationId (UUID)
     ├─► enfileira job
     └─► retorna 202 { status: 'queued', correlationId } ← Meta recebe isso rápido
(background, assíncrono)
Worker FIFO
     │
     ├─► chama LLM (simulado: 2–8s, 20% falha)
     ├─► em sucesso: loga [MOCK SEND] com telefone mascarado
     └─► em falha: loga erro e continua (não derruba o processo)
```
## Como Rodar
```bash
# 1. Instalar dependências
npm install
# 2. Subir servidor em modo desenvolvimento
npm run dev
# 3. Enviar uma mensagem de teste
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"userId":"u1","phone":"11999998888","message":"Quero resolver minha dívida"}'
# Resposta imediata:
# {"status":"queued","correlationId":"<uuid>"}
# Nos logs do servidor, após 2–8s:
# [INFO] [MOCK SEND] → 119****8888: Resposta gerada para: "Quero resolver minha dívida"
```
## Testes
```bash
npm test
```
Cobre: retorno 202, retorno 400 com campos faltando, mascaramento de PII.
## Estrutura
```
src/
  types/index.ts            interfaces WebhookPayload e QueueJob
  utils/
    piiMasker.ts            maskPhone: "11999998888" → "119****8888"
    logger.ts               wrapper de console que sanitiza PII automaticamente
  services/
    llmService.ts           interface LLMService + SimulatedLLMService
    InMemoryQueue.ts        Singleton FIFO com worker assíncrono
  controllers/
    webhookController.ts    valida payload, enfileira, retorna 202
  app.ts                    configura Express
  server.ts                 entry point
tests/
  webhook.test.ts           testes com Vitest + Supertest
```
## Decisões de Arquitetura
**Por que não Redis / RabbitMQ?**

A PoC precisa rodar com `npm install` + `npm run dev`, sem Docker ou serviços externos. Tudo em memória é suficiente para demonstrar o padrão.

**Por que não Nginx?**

Desnecessário nessa escala e adicionaria acoplamento sem benefício para a PoC.

**Por que TypeScript (Node.js single-thread)?**

TypeScript sobre Node.js é intencionalmente uma escolha que adiciona dificuldade: o runtime roda em uma única thread e, sem cuidado, uma operação bloqueante paralisa todo o servidor — incluindo o retorno imediato do 202 que é o coração da solução. Escolhi essa stack justamente para explorar essa restrição de frente: o desafio foi provar que é possível construir um serviço não-bloqueante e responsivo mesmo dentro de um modelo single-thread, usando o event loop e `async/await` de forma correta em vez de escapar para uma linguagem multi-thread. O resultado demonstra que a limitação é gerenciável quando a arquitetura respeita o modelo de concorrência da plataforma.

**SOLID (S e D)**
- *Single Responsibility*: cada arquivo tem exatamente uma responsabilidade.
- *Dependency Inversion*: `InMemoryQueue` depende da interface `LLMService`, não da implementação concreta. Isso permite injetar um mock nos testes sem alterar a lógica da fila.
**Idempotência**
Cada job ganha um `correlationId` (UUID) ao entrar na fila. O worker guarda os IDs processados em um `Set`. Se o mesmo webhook disparar duas vezes (comportamento comum da Meta em retries), o job duplicado é descartado silenciosamente.
**Segurança de Dados (PII)**
Telefones nunca aparecem em claro nos logs. O `logger` sanitiza automaticamente qualquer campo `phone` antes de imprimir. O `[MOCK SEND]` final também usa o número mascarado.
## O Que Foi Deixado de Fora (escopo PoC)
- Persistência: se o processo reiniciar, jobs pendentes são perdidos.
- Retry com backoff: falhas do LLM simplesmente são logadas; não há re-enfileiramento.
- Autenticação do webhook (verificação de assinatura da Meta).
- Concorrência paralela: o worker processa um job por vez, intencionalmente simples.
---
> This is a challenge by [Coodesh](https://coodesh.com/)

---
---

# Lexi Webhook PoC
PoC of a non-blocking webhook service for Lexi, Arbitralis's negotiation agent.
## Technologies
- **Node.js** v20+
- **TypeScript** 5.3
- **Express** 4.18
- **Vitest** 1.2
- **tsx** — TypeScript execution in development
- **uuid** — unique correlationId generation per job
- **supertest** — HTTP requests in tests
## The Problem
Meta's (WhatsApp) webhook waits for a response on the same HTTP connection. When the LLM was slow, Meta timed out and messages were lost mid-negotiation.
## The Solution
Decouple receiving from processing: the endpoint returns **202 Accepted** to Meta in milliseconds and processes the LLM in the background via an in-memory queue.
```
POST /webhook
     │
     ├─► validates payload
     ├─► generates correlationId (UUID)
     ├─► enqueues job
     └─► returns 202 { status: 'queued', correlationId } ← Meta receives this fast
(background, asynchronous)
FIFO Worker
     │
     ├─► calls LLM (simulated: 2–8s, 20% failure rate)
     ├─► on success: logs [MOCK SEND] with masked phone number
     └─► on failure: logs error and continues (does not crash the process)
```
## How to Run
```bash
# 1. Install dependencies
npm install
# 2. Start server in development mode
npm run dev
# 3. Send a test message
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"userId":"u1","phone":"11999998888","message":"Quero resolver minha dívida"}'
# Immediate response:
# {"status":"queued","correlationId":"<uuid>"}
# In the server logs, after 2–8s:
# [INFO] [MOCK SEND] → 119****8888: Generated response for: "Quero resolver minha dívida"
```
## Tests
```bash
npm test
```
Covers: 202 response, 400 response with missing fields, PII masking.
## Structure
```
src/
  types/index.ts            WebhookPayload and QueueJob interfaces
  utils/
    piiMasker.ts            maskPhone: "11999998888" → "119****8888"
    logger.ts               console wrapper that automatically sanitizes PII
  services/
    llmService.ts           LLMService interface + SimulatedLLMService
    InMemoryQueue.ts        Singleton FIFO with async worker
  controllers/
    webhookController.ts    validates payload, enqueues, returns 202
  app.ts                    configures Express
  server.ts                 entry point
tests/
  webhook.test.ts           tests with Vitest + Supertest
```
## Architecture Decisions
**Why not Redis / RabbitMQ?**

The PoC needs to run with just `npm install` + `npm run dev`, with no Docker or external services. Everything in memory is sufficient to demonstrate the pattern.

**Why not Nginx?**

Unnecessary at this scale and would add coupling with no benefit for the PoC.

**Why TypeScript (single-threaded Node.js)?**

TypeScript on Node.js is an intentionally harder choice: the runtime runs on a single thread, and without care, any blocking operation stalls the entire server — including the immediate 202 response that is the core of the solution. I chose this stack precisely to take that constraint head-on: the challenge was to prove it is possible to build a non-blocking, responsive service even within a single-threaded model, by using the event loop and `async/await` correctly instead of escaping to a multi-threaded language. The result demonstrates that the limitation is manageable when the architecture respects the platform's concurrency model.

**SOLID (S and D)**
- *Single Responsibility*: each file has exactly one responsibility.
- *Dependency Inversion*: `InMemoryQueue` depends on the `LLMService` interface, not on the concrete implementation. This allows injecting a mock in tests without changing the queue logic.
**Idempotency**
Each job receives a `correlationId` (UUID) when it enters the queue. The worker stores processed IDs in a `Set`. If the same webhook fires twice (common Meta retry behavior), the duplicate job is silently discarded.
**Data Security (PII)**
Phone numbers never appear in plain text in the logs. The `logger` automatically sanitizes any `phone` field before printing. The final `[MOCK SEND]` also uses the masked number.
## What Was Left Out (PoC scope)
- Persistence: if the process restarts, pending jobs are lost.
- Retry with backoff: LLM failures are simply logged; there is no re-queuing.
- Webhook authentication (Meta signature verification).
- Parallel concurrency: the worker processes one job at a time, intentionally kept simple.
---
> This is a challenge by [Coodesh](https://coodesh.com/)
