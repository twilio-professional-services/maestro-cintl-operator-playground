import { MaestroClient } from './maestro-client';
import {
  Transcript,
  TranscriptMessage,
  ParticipantResponse,
  CommunicationResponse,
  ExtractableChannel,
} from './types';

export class TranscriptExtractor {
  private maestroClient: MaestroClient;

  constructor(maestroClient: MaestroClient) {
    this.maestroClient = maestroClient;
  }

  /**
   * Extract a conversation by call SID and convert it to transcript format
   */
  async extract(callSid: string): Promise<Transcript> {
    console.log(`\nFetching conversation with call SID: ${callSid}`);

    // 1. Find conversation by channelId (call SID)
    const conversation = await this.maestroClient.getConversationByChannelId(callSid);
    if (!conversation) {
      throw new Error(`No conversation found with call SID: ${callSid}`);
    }

    console.log(`✓ Found conversation: ${conversation.id}`);

    // 2. Fetch participants
    const participants = await this.maestroClient.getParticipants(conversation.id);
    console.log(`✓ Fetched ${participants.length} participants`);

    // 3. Fetch all communications (with pagination)
    const communications = await this.maestroClient.getAllCommunications(conversation.id);
    console.log(`✓ Fetched ${communications.length} communications`);

    // Maestro API returns communications in reverse chronological order (newest first)
    // Reverse to get chronological order (oldest first) for transcript
    communications.reverse();

    // 4. Transform to transcript format
    const transcript = this.buildTranscript(
      conversation.name,
      conversation.id,
      participants,
      communications
    );

    console.log(`✓ Successfully extracted transcript`);
    return transcript;
  }

  /**
   * Build a transcript from Maestro API responses
   */
  private buildTranscript(
    conversationName: string,
    conversationId: string,
    participants: ParticipantResponse[],
    communications: CommunicationResponse[]
  ): Transcript {
    // Map participants to customer/agent
    const { customer, agent } = this.mapParticipants(participants);

    // Transform communications to messages
    const messages = this.transformCommunications(communications, participants);

    // Use conversation name if available, otherwise generate one
    const name = conversationName || `Conversation ${conversationId}`;

    return {
      metadata: {
        name,
      },
      participants: {
        customer,
        agent,
      },
      messages,
    };
  }

  /**
   * Map Maestro participants to transcript customer/agent format
   */
  private mapParticipants(participants: ParticipantResponse[]): {
    customer: { address: string; channel: ExtractableChannel };
    agent: { address: string; channel: ExtractableChannel };
  } {
    // Find customer and agent participants
    const customerParticipant = participants.find((p) => p.type === 'CUSTOMER');
    const agentParticipant = participants.find((p) => p.type === 'HUMAN_AGENT');

    if (!customerParticipant) {
      throw new Error('No CUSTOMER participant found in conversation');
    }

    if (!agentParticipant) {
      throw new Error('No HUMAN_AGENT participant found in conversation');
    }

    if (!customerParticipant.addresses || customerParticipant.addresses.length === 0) {
      throw new Error('CUSTOMER participant has no addresses');
    }

    if (!agentParticipant.addresses || agentParticipant.addresses.length === 0) {
      throw new Error('HUMAN_AGENT participant has no addresses');
    }

    // Use first address for each participant
    const customerAddress = customerParticipant.addresses[0];
    const agentAddress = agentParticipant.addresses[0];

    return {
      customer: {
        address: customerAddress.address,
        channel: this.normalizeChannel(customerAddress.channel),
      },
      agent: {
        address: agentAddress.address,
        channel: this.normalizeChannel(agentAddress.channel),
      },
    };
  }

  /**
   * Normalize Maestro channel to transcript format
   */
  private normalizeChannel(channel: string): ExtractableChannel {
    const upperChannel = channel.toUpperCase();

    // Direct mappings
    if (upperChannel === 'SMS' || upperChannel === 'VOICE' || upperChannel === 'EMAIL') {
      return upperChannel as ExtractableChannel;
    }

    // Map similar channels to supported types
    if (upperChannel === 'WHATSAPP' || upperChannel === 'RCS' || upperChannel === 'CHAT') {
      console.warn(`⚠ Channel ${channel} mapped to SMS for transcript format`);
      return 'SMS';
    }

    // Default to SMS for unknown channels
    console.warn(`⚠ Unknown channel ${channel}, defaulting to SMS`);
    return 'SMS';
  }

  /**
   * Transform communications to transcript messages
   */
  private transformCommunications(
    communications: CommunicationResponse[],
    participants: ParticipantResponse[]
  ): TranscriptMessage[] {
    // Build participant ID to type map
    const participantMap = new Map<string, 'customer' | 'agent'>();
    participants.forEach((p) => {
      if (p.type === 'CUSTOMER') {
        participantMap.set(p.id, 'customer');
      } else if (p.type === 'HUMAN_AGENT') {
        participantMap.set(p.id, 'agent');
      }
    });

    const messages: TranscriptMessage[] = [];

    for (const comm of communications) {
      // Skip if no participantId or unknown participant
      if (!comm.author.participantId) {
        console.warn(`⚠ Skipping communication ${comm.id}: no participantId`);
        continue;
      }

      const role = participantMap.get(comm.author.participantId);
      if (!role) {
        console.warn(`⚠ Skipping communication ${comm.id}: unknown participant ${comm.author.participantId}`);
        continue;
      }

      // Extract text based on content type
      const text = this.extractText(comm);
      if (text === null) {
        console.warn(`⚠ Skipping communication ${comm.id}: unsupported content type ${comm.content.type}`);
        continue;
      }

      messages.push({ role, text });
    }

    return messages;
  }

  /**
   * Extract text from communication content based on type
   */
  private extractText(communication: CommunicationResponse): string | null {
    const contentType = communication.content.type.toUpperCase();

    // Handle TEXT type
    if (contentType === 'TEXT') {
      return communication.content.text;
    }

    // Handle TRANSCRIPTION type (voice calls)
    if (contentType === 'TRANSCRIPTION') {
      return communication.content.text;
    }

    // Unknown content type
    return null;
  }
}
