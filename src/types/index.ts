export interface WebhookPayload {
  userId: string;
  phone: string;
  message: string;
}

export interface QueueJob {
  correlationId: string;
  payload: WebhookPayload;
  enqueuedAt: Date;
}
