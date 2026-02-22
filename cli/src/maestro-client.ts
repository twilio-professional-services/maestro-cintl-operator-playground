import axios, { AxiosInstance } from 'axios';
import {
  Config,
  CreateConversationRequest,
  ConversationResponse,
  CreateParticipantRequest,
  ParticipantResponse,
  CreateCommunicationRequest,
  CommunicationResponse,
  UpdateConversationRequest,
  ListConversationsResponse,
  ListParticipantsResponse,
  ListCommunicationsResponse,
} from './types';

export class MaestroClient {
  private client: AxiosInstance;
  private configurationId: string;

  constructor(config: Config) {
    this.configurationId = config.conversationConfigurationId;

    // Create axios instance with authentication (v2 API uses X-Pre-Auth-Context header)
    this.client = axios.create({
      baseURL: 'https://conversations.twilio.com/v2/',
      auth: {
        username: config.accountSid,
        password: config.authToken,
      },
      headers: {
        'Content-Type': 'application/json',
        'X-Pre-Auth-Context': config.accountSid,
      },
    });
  }

  async createConversation(request: CreateConversationRequest): Promise<ConversationResponse> {
    try {
      const response = await this.client.post<ConversationResponse>(
        `Conversations`,
        request
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to create conversation: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  async addParticipant(
    conversationId: string,
    request: CreateParticipantRequest
  ): Promise<ParticipantResponse> {
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

  async createCommunication(
    conversationId: string,
    request: CreateCommunicationRequest
  ): Promise<CommunicationResponse> {
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
      const request: UpdateConversationRequest = { status: 'CLOSED' };
      const response = await this.client.put<ConversationResponse>(
        `Conversations/${conversationId}`,
        request
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
      const response = await this.client.get<ListConversationsResponse>(
        `Conversations`,
        {
          params: { channelId }
        }
      );

      if (response.data.conversations && response.data.conversations.length > 0) {
        return response.data.conversations[0];
      }

      return null;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to get conversation by channel ID: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  async getParticipants(conversationId: string): Promise<ParticipantResponse[]> {
    try {
      const response = await this.client.get<ListParticipantsResponse>(
        `Conversations/${conversationId}/Participants`
      );
      return response.data.participants || [];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to get participants: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  async getAllCommunications(conversationId: string): Promise<CommunicationResponse[]> {
    try {
      const allCommunications: CommunicationResponse[] = [];
      let nextToken: string | undefined;

      do {
        const response = await this.client.get<ListCommunicationsResponse>(
          `Conversations/${conversationId}/Communications`,
          {
            params: nextToken ? { nextToken } : undefined
          }
        );

        if (response.data.communications) {
          allCommunications.push(...response.data.communications);
        }

        nextToken = response.data.meta?.nextToken;
      } while (nextToken);

      return allCommunications;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to get communications: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }
}
