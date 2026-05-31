// D (Dependency Inversion): o worker depende dessa interface, não da implementação concreta.
export interface LLMService {
  processMessage(message: string): Promise<string>;
}

export class SimulatedLLMService implements LLMService {
  async processMessage(message: string): Promise<string> {
    const delay = Math.floor(Math.random() * 6000) + 2000; // 2–8s
    return new Promise((resolve, reject) =>
      setTimeout(() => {
        if (Math.random() < 0.2) {
          reject(new Error('LLM API failure: simulated instability'));
        } else {
          resolve(`Resposta gerada para: "${message}"`);
        }
      }, delay)
    );
  }
}
