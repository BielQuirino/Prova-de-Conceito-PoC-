import express from 'express';
import { webhookHandler } from './controllers/webhookController';

export const app = express();
app.use(express.json());

app.post('/webhook', webhookHandler);
