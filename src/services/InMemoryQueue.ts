import { v4 as uuidv4 } from 'uuid';
import { LLMService, SimulatedLLMService } from './llmService';
import { logger } from '../utils/logger';
import { maskPhone } from '../utils/piiMasker';
import { QueueJob, WebhookPayload } from '../types';

// S (Single Responsibility): gerencia exclusivamente o estado da fila e o ciclo do worker.
export class InMemoryQueue {
  private static instance: InMemoryQueue;
  private jobs: QueueJob[] = [];
  // Idempotência: evita reprocessar o mesmo job caso o webhook dispare duplicado.
  private processedIds = new Set<string>();

  private constructor(private readonly llm: LLMService) {
    this.startWorker();
  }

  // D (Dependency Inversion): aceita injeção de LLMService, permitindo mock em testes.
  static getInstance(llm?: LLMService): InMemoryQueue {
    if (!InMemoryQueue.instance) {
      InMemoryQueue.instance = new InMemoryQueue(llm ?? new SimulatedLLMService());
    }
    return InMemoryQueue.instance;
  }

  enqueue(payload: WebhookPayload): string {
    const correlationId = uuidv4();
    this.jobs.push({ correlationId, payload, enqueuedAt: new Date() });
    logger.info('Job enqueued', { correlationId, userId: payload.userId });
    return correlationId;
  }

  private async startWorker(): Promise<void> {
    // Loop FIFO contínuo; processa um job por vez para não sobrecarregar o LLM.
    while (true) {
      const job = this.jobs.shift();
      if (job) {
        await this.process(job);
      } else {
        // Pausa curta para não girar a CPU em idle (busy-wait).
        await new Promise(r => setTimeout(r, 100));
      }
    }
  }

  private async process(job: QueueJob): Promise<void> {
    const { correlationId, payload } = job;

    if (this.processedIds.has(correlationId)) {
      logger.info('Duplicate job skipped', { correlationId });
      return;
    }

    try {
      logger.info('Processing job', { correlationId, userId: payload.userId });
      const response = await this.llm.processMessage(payload.message);
      this.processedIds.add(correlationId);
      // Simula o envio da resposta de volta ao usuário via WhatsApp API.
      logger.info(`[MOCK SEND] → ${maskPhone(payload.phone)}: ${response}`, { correlationId });
    } catch (err) {
      // Graceful error handling: loga o erro sem derrubar o processo.
      logger.error(`Job ${correlationId} failed`, err);
    }
  }
}
