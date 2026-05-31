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
