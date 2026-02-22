// Transcript Input Format
export interface TranscriptMessage {
  role: "customer" | "agent";
  text: string;
}

export interface Transcript {
  metadata: {
    name: string;
    description?: string;
  };
  participants: {
    customer: {
      address: string;
      channel: "SMS" | "VOICE" | "EMAIL";
    };
    agent: {
      address: string;
      channel: "SMS" | "VOICE" | "EMAIL";
    };
  };
  messages: TranscriptMessage[];
}

// Maestro API Types
export interface CreateConversationRequest {
  configurationId: string;
}

export interface ConversationResponse {
  id: string;
  accountId: string;
  serviceId: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  configuration?: {
    intelligenceServiceIds?: string[];
  };
}

export interface CreateParticipantRequest {
  name?: string;
  type: "HUMAN_AGENT" | "CUSTOMER" | "AI_AGENT";
  addresses: Array<{
    channel: "VOICE" | "SMS" | "RCS" | "EMAIL" | "WHATSAPP" | "CHAT" | "API" | "SYSTEM";
    address: string;
    channelId?: string;
  }>;
  profileId?: string;
}

export interface ParticipantResponse {
  id: string;
  conversationId: string;
  accountId: string;
  serviceId: string;
  name?: string;
  type: "HUMAN_AGENT" | "CUSTOMER" | "AI_AGENT";
  addresses: Array<{
    channel: string;
    address: string;
    channelId?: string;
  }>;
  profileId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCommunicationRequest {
  author: {
    address: string;
    channel: string;
    participantId?: string;
  };
  content: {
    type: "TEXT";
    text: string;
  };
  recipients: Array<{
    address: string;
    channel: string;
    participantId?: string;
  }>;
}

export interface CommunicationResponse {
  id: string;
  conversationId: string;
  author: {
    address: string;
    channel: string;
    participantId?: string;
  };
  content: {
    type: string;
    text: string;
  };
  recipients: Array<{
    address: string;
    channel: string;
    participantId?: string;
  }>;
  createdAt: string;
}

export interface UpdateConversationRequest {
  status: "CLOSED";
}

// List response types for pagination
export interface ListConversationsResponse {
  conversations: ConversationResponse[];
  meta: { nextToken?: string; pageSize?: number; };
}

export interface ListParticipantsResponse {
  participants: ParticipantResponse[];
  meta: { nextToken?: string; pageSize?: number; };
}

export interface ListCommunicationsResponse {
  communications: CommunicationResponse[];
  meta: { nextToken?: string; pageSize?: number; };
}

// Supported channels for transcript format
export type ExtractableChannel = "SMS" | "VOICE" | "EMAIL";

// Webhook Event Types
export interface OperatorWebhookPayload {
  accountId: string;
  conversationId: string;
  intelligenceConfiguration: {
    id: string;
    displayName: string;
    version: number;
    ruleId: string;
  };
  receivedAt?: Date; // Added by webhook server when received
  operatorResults: Array<{
    id: string;
    operator: {
      id: string;
      displayName: string;
      version: number;
      parameters: any;
    };
    outputFormat: string;
    result: any;
    dateCreated: string;
    referenceIds: string[];
    executionDetails: {
      trigger: {
        on: string;
        timestamp: string;
      };
      communications: {
        first: string;
        last: string;
      };
      channels: string[];
      participants: Array<{
        id: string;
        profileId: string | null;
        type: string;
      }>;
      context: {
        customerMemory: any;
        knowledge: {
          bases: any[];
        };
      };
    };
  }>;
}

// Configuration
export interface Config {
  accountSid: string;
  authToken: string;
  conversationConfigurationId: string;
  webhookPort: number;
  webhookPath: string;
}
