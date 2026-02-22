import { MaestroClient } from "./maestro-client";
import { WebhookServer } from "./webhook-server";
import { Config, Transcript } from "./types";

export class TranscriptReplayer {
  private maestroClient: MaestroClient;
  private webhookServer: WebhookServer;
  private config: Config;

  constructor(
    maestroClient: MaestroClient,
    webhookServer: WebhookServer,
    config: Config,
  ) {
    this.maestroClient = maestroClient;
    this.webhookServer = webhookServer;
    this.config = config;
  }

  async replay(transcript: Transcript): Promise<void> {
    let conversationId: string | null = null;
    let customerParticipantId: string | null = null;
    let agentParticipantId: string | null = null;

    try {
      // Step 1: Start webhook server
      console.log("[STEP 1] Starting webhook server...");
      await this.webhookServer.start();
      console.log(`  Listening on port ${this.config.webhookPort}`);
      console.log(`  Webhook path: ${this.config.webhookPath}`);
      console.log(
        `  Make sure your Intelligence Config webhook URL points to: https://your-ngrok-url${this.config.webhookPath}`,
      );

      // Step 2: Create Maestro conversation
      console.log("\n[STEP 2] Creating Maestro conversation...");
      const conversation = await this.maestroClient.createConversation({
        configurationId: this.config.conversationConfigurationId,
      });
      conversationId = conversation.id;
      console.log(`  Conversation ID: ${conversationId}`);
      console.log(`  Configuration ID: ${this.config.conversationConfigurationId}`);

      // Step 3: Add participants
      console.log("\n[STEP 3] Adding participants...");

      // Add customer participant
      const customerParticipant = await this.maestroClient.addParticipant(
        conversationId,
        {
          type: "CUSTOMER",
          name: "Customer",
          addresses: [
            {
              channel: transcript.participants.customer.channel,
              address: transcript.participants.customer.address,
            },
          ],
        },
      );
      customerParticipantId = customerParticipant.id;
      console.log(`  Customer Participant ID: ${customerParticipantId}`);

      // Add agent participant
      const agentParticipant = await this.maestroClient.addParticipant(
        conversationId,
        {
          type: "HUMAN_AGENT",
          name: "Agent",
          addresses: [
            {
              channel: transcript.participants.agent.channel,
              address: transcript.participants.agent.address,
            },
          ],
        },
      );
      agentParticipantId = agentParticipant.id;
      console.log(`  Agent Participant ID: ${agentParticipantId}`);

      // Step 4: Replay transcript messages
      console.log(
        `\n[STEP 4] Replaying ${transcript.messages.length} messages...`,
      );
      for (const [index, message] of transcript.messages.entries()) {
        const isCustomer = message.role === "customer";
        const authorParticipantId = isCustomer
          ? customerParticipantId
          : agentParticipantId;
        const recipientParticipantId = isCustomer
          ? agentParticipantId
          : customerParticipantId;
        const author = isCustomer
          ? transcript.participants.customer
          : transcript.participants.agent;
        const recipient = isCustomer
          ? transcript.participants.agent
          : transcript.participants.customer;

        const truncatedText =
          message.text.length > 60
            ? `${message.text.substring(0, 60)}...`
            : message.text;
        console.log(
          `  [${index + 1}/${transcript.messages.length}] ${message.role}: "${truncatedText}"`,
        );

        await this.maestroClient.createCommunication(conversationId, {
          author: {
            address: author.address,
            channel: author.channel,
            participantId: authorParticipantId!,
          },
          content: {
            type: "TEXT",
            text: message.text,
          },
          recipients: [
            {
              address: recipient.address,
              channel: recipient.channel,
              participantId: recipientParticipantId!,
            },
          ],
        });

        // Small delay between messages to simulate realistic timing
        await this.sleep(500);
      }

      // Step 5: Close conversation
      console.log("\n[STEP 5] Closing conversation...");
      await this.maestroClient.closeConversation(conversationId);
      console.log(
        "  Conversation closed - this will trigger conversation_end operators",
      );

      // Step 6: Log buffered webhooks that arrived before conversation closed
      const bufferedCount = this.webhookServer.flushBufferedWebhooks();
      if (bufferedCount > 0) {
        console.log(
          `\n[STEP 6] Logged ${bufferedCount} webhook(s) received during conversation`,
        );
      } else {
        console.log("\n[STEP 6] No webhooks received during conversation");
      }

      // Step 7: Switch to real-time logging and wait for more webhooks
      console.log("\n[STEP 7] Waiting for operator result webhooks...");
      console.log("  (New webhooks will be logged in real-time)");
      console.log("  Press Ctrl-C to stop");

      this.webhookServer.enableRealTimeLogging();

      // Wait indefinitely - user will Ctrl-C when ready
      await new Promise(() => {
        // Never resolves - user must Ctrl-C
      });

      // This code only runs if something interrupts the wait (never reached normally)
    } catch (error) {
      if (error instanceof Error) {
        console.error("\n[ERROR] Replay failed:", error.message);
        throw error;
      } else {
        console.error("\n[ERROR] Replay failed:", error);
        throw error;
      }
    } finally {
      // Always try to stop the webhook server
      try {
        await this.webhookServer.stop();
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
