import { Request, Response } from 'express';
import { InMemoryQueue } from '../services/InMemoryQueue';
import { WebhookPayload } from '../types';

// S (Single Responsibility): trata exclusivamente o contrato HTTP do webhook.
export function webhookHandler(req: Request, res: Response): void {
  const { userId, phone, message } = req.body as WebhookPayload;

  if (!userId || !phone || !message) {
    res.status(400).json({ error: 'Missing required fields: userId, phone, message' });
    return;
  }

  const correlationId = InMemoryQueue.getInstance().enqueue({ userId, phone, message });

  // Retorna 202 imediatamente — a Meta não aguarda o processamento do LLM.
  res.status(202).json({ status: 'queued', correlationId });
}
