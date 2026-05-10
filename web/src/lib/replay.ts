import { createMaestroClient } from './maestro-client';
import { updateSimulatedCall } from './db';
import type { Transcript } from '@/types';


export async function runReplay(transcript: Transcript, simulatedCallId: number, customerPhone?: string): Promise<void> {
  const client = createMaestroClient();

  // Use the selected profile phone if provided, otherwise fall back to the transcript address
  const customerAddress = customerPhone ?? transcript.participants.customer.address;

  try {
    // Create conversation
    const conversation = await client.createConversation({
      configurationId: client.configurationId,
    });
    const conversationId = conversation.id;

    updateSimulatedCall(simulatedCallId, { conversation_id: conversationId });

    // Add participants
    const customerParticipant = await client.addParticipant(conversationId, {
      type: 'CUSTOMER',
      name: 'Customer',
      addresses: [{
        channel: transcript.participants.customer.channel,
        address: customerAddress,
      }],
    });

    const agentParticipant = await client.addParticipant(conversationId, {
      type: 'HUMAN_AGENT',
      name: 'Agent',
      addresses: [{
        channel: transcript.participants.agent.channel,
        address: transcript.participants.agent.address,
      }],
    });

    // Replay messages
    for (const message of transcript.messages) {
      const isCustomer = message.role === 'customer';
      const authorAddress = isCustomer ? customerAddress : transcript.participants.agent.address;
      const authorChannel = isCustomer ? transcript.participants.customer.channel : transcript.participants.agent.channel;
      const recipientAddress = isCustomer ? transcript.participants.agent.address : customerAddress;
      const recipientChannel = isCustomer ? transcript.participants.agent.channel : transcript.participants.customer.channel;
      const authorParticipantId = isCustomer ? customerParticipant.id : agentParticipant.id;
      const recipientParticipantId = isCustomer ? agentParticipant.id : customerParticipant.id;

      await client.createCommunication(conversationId, {
        author: { address: authorAddress, channel: authorChannel, participantId: authorParticipantId },
        content: { type: 'TEXT', text: message.text },
        recipients: [{ address: recipientAddress, channel: recipientChannel, participantId: recipientParticipantId }],
      });

    }

    // Close conversation — triggers conversation_end operators
    await client.closeConversation(conversationId);
  } catch (error) {
    throw error;
  }
}
