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
}
