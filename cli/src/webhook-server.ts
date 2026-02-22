import express, { Application, Request, Response } from 'express';
import { OperatorWebhookPayload } from './types';
import { Server } from 'http';

export class WebhookServer {
  private app: Application;
  private port: number;
  private webhookPath: string;
  private receivedWebhooks: OperatorWebhookPayload[] = [];
  private server: Server | null = null;
  private isBuffering: boolean = true;

  constructor(port: number, path: string) {
    this.port = port;
    this.webhookPath = path;
    this.app = express();
    this.app.use(express.json());
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // POST /webhook/operator - Receive operator webhooks
    this.app.post(this.webhookPath, (req: Request, res: Response) => {
      const payload: OperatorWebhookPayload = req.body;

      // Track when we received this webhook
      payload.receivedAt = new Date();

      this.receivedWebhooks.push(payload);

      // If buffering is off, log immediately (real-time mode)
      if (!this.isBuffering) {
        this.logWebhookPayload(payload, this.receivedWebhooks.length);
      }

      // Acknowledge webhook
      res.status(200).json({ received: true });
    });

    // GET /health - Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.status(200).json({ status: 'ok' });
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`[SERVER] Webhook server listening on port ${this.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  getReceivedWebhooks(): OperatorWebhookPayload[] {
    return this.receivedWebhooks;
  }

  flushBufferedWebhooks(): number {
    const count = this.receivedWebhooks.length;
    if (count > 0) {
      this.receivedWebhooks.forEach((wh, i) => {
        this.logWebhookPayload(wh, i + 1);
      });
    }
    return count;
  }

  enableRealTimeLogging(): void {
    this.isBuffering = false;
  }

  private logWebhookPayload(wh: OperatorWebhookPayload, index: number): void {
    console.log(`\n[WEBHOOK ${index}] Received operator webhook:`);
    console.log(`  Conversation: ${wh.conversationId}`);
    console.log(
      `  Intelligence Config: ${wh.intelligenceConfiguration.displayName} (v${wh.intelligenceConfiguration.version})`,
    );
    console.log(`  Operator Results: ${wh.operatorResults.length}`);

    wh.operatorResults.forEach((result, j) => {
      // Calculate duration from trigger to webhook received
      let durationStr = '';
      if (wh.receivedAt) {
        const triggerTime = new Date(result.executionDetails.trigger.timestamp);
        const receivedTime = wh.receivedAt;
        const durationMs = receivedTime.getTime() - triggerTime.getTime();
        const durationSeconds = (durationMs / 1000).toFixed(2);
        durationStr = ` (${durationSeconds} Seconds)`;
      }

      console.log(
        `\n    Result ${j + 1}: ${result.operator.displayName} (v${result.operator.version})${durationStr}`,
      );
      console.log(`      ID: ${result.id}`);
      console.log(`      Output Format: ${result.outputFormat}`);
      console.log(
        `      Trigger: ${result.executionDetails.trigger.on} at ${result.executionDetails.trigger.timestamp}`,
      );
      console.log(
        `      Channels: ${result.executionDetails.channels.join(", ")}`,
      );
      console.log(
        `      Participants: ${result.executionDetails.participants.length}`,
      );
      result.executionDetails.participants.forEach((p) => {
        console.log(`        - ${p.type} (${p.id})`);
      });
      console.log(`      Result:`);
      console.log(
        `        ${JSON.stringify(result.result, null, 2)
          .split("\n")
          .join("\n        ")}`,
      );
    });
  }
}
