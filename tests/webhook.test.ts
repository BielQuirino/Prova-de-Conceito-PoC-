import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { maskPhone } from '../src/utils/piiMasker';

// Mock da fila para que os testes não disparem o worker real (com sleep de 2-8s).
vi.mock('../src/services/InMemoryQueue', () => ({
  InMemoryQueue: {
    getInstance: () => ({
      enqueue: vi.fn().mockReturnValue('test-correlation-id'),
    }),
  },
}));

const { app } = await import('../src/app');

describe('POST /webhook', () => {
  it('responds 202 with queued status and correlationId', async () => {
    const res = await request(app)
      .post('/webhook')
      .send({ userId: 'user-1', phone: '11999998888', message: 'Quero resolver minha dívida' });

    expect(res.status).toBe(202);
    expect(res.body.status).toBe('queued');
    expect(res.body.correlationId).toBeDefined();
  });

  it('responds 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/webhook')
      .send({ userId: 'user-1' }); // faltam phone e message

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Missing required fields/);
  });

  it('responds 400 when body is empty', async () => {
    const res = await request(app).post('/webhook').send({});
    expect(res.status).toBe(400);
  });
});

describe('maskPhone', () => {
  it('masks a standard 11-digit phone', () => {
    expect(maskPhone('11999998888')).toBe('119****8888');
  });

  it('masks a 10-digit phone', () => {
    // slice(0,3) = '119', slice(-4) = '8888'
    expect(maskPhone('1199998888')).toBe('119****8888');
  });

  it('returns *** for very short numbers', () => {
    expect(maskPhone('123')).toBe('***');
  });

  it('handles 8-digit minimum correctly', () => {
    // slice(0,3) = '123', slice(-4) = '5678'
    expect(maskPhone('12345678')).toBe('123****5678');
  });
});
