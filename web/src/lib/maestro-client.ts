import axios, { AxiosInstance } from 'axios';
import type {
  CreateConversationRequest,
  ConversationResponse,
  CreateParticipantRequest,
  ParticipantResponse,
  CreateCommunicationRequest,
  CommunicationResponse,
  ListConversationsResponse,
  ListParticipantsResponse,
  ListCommunicationsResponse,
} from '@/types';

export class MaestroClient {
  private client: AxiosInstance;
  readonly configurationId: string;

  constructor(accountSid: string, authToken: string, configurationId: string) {
    this.configurationId = configurationId;

    this.client = axios.create({
      baseURL: 'https://conversations.twilio.com/v2/',
      auth: {
        username: accountSid,
        password: authToken,
      },
      headers: {
        'Content-Type': 'application/json',
        'X-Pre-Auth-Context': accountSid,
      },
    });
  }

  async createConversation(request: CreateConversationRequest): Promise<ConversationResponse> {
    try {
      const response = await this.client.post<ConversationResponse>('Conversations', request);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to create conversation: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  async addParticipant(conversationId: string, request: CreateParticipantRequest): Promise<ParticipantResponse> {
    try {
      const response = await this.client.post<ParticipantResponse>(
        `Conversations/${conversationId}/Participants`,
        request
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to add participant: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  async createCommunication(conversationId: string, request: CreateCommunicationRequest): Promise<CommunicationResponse> {
    try {
      const response = await this.client.post<CommunicationResponse>(
        `Conversations/${conversationId}/Communications`,
        request
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to create communication: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  async closeConversation(conversationId: string): Promise<ConversationResponse> {
    try {
      const response = await this.client.put<ConversationResponse>(
        `Conversations/${conversationId}`,
        { status: 'CLOSED' }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to close conversation: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  async getConversationByChannelId(channelId: string): Promise<ConversationResponse | null> {
    try {
      const response = await this.client.get<ListConversationsResponse>('Conversations', {
        params: { channelId },
      });
      return response.data.conversations?.[0] ?? null;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to get conversation: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  async getParticipants(conversationId: string): Promise<ParticipantResponse[]> {
    try {
      const response = await this.client.get<ListParticipantsResponse>(
        `Conversations/${conversationId}/Participants`
      );
      return response.data.participants ?? [];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to get participants: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  async getAllCommunications(conversationId: string): Promise<CommunicationResponse[]> {
    try {
      const all: CommunicationResponse[] = [];
      let nextToken: string | undefined;

      do {
        const response = await this.client.get<ListCommunicationsResponse>(
          `Conversations/${conversationId}/Communications`,
          { params: nextToken ? { nextToken } : undefined }
        );
        if (response.data.communications) {
          all.push(...response.data.communications);
        }
        nextToken = response.data.meta?.nextToken;
      } while (nextToken);

      return all;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to get communications: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }
}

export function createMaestroClient(): MaestroClient {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const configurationId = process.env.CONVERSATION_CONFIGURATION_ID;

  if (!accountSid || !authToken || !configurationId) {
    throw new Error(
      'Missing required env vars: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, CONVERSATION_CONFIGURATION_ID'
    );
  }

  return new MaestroClient(accountSid, authToken, configurationId);
}
