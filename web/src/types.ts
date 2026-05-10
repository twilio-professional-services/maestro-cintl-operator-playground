// Transcript Input Format
export interface TranscriptMessage {
  role: "customer" | "agent";
  text: string;
}

export interface Transcript {
  metadata: {
    name: string;
    description?: string;
    sentiment?: "positive" | "negative" | "neutral" | "mixed";
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

// Conversation Orchestrator API Types
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

// List response types for pagination
export interface ListConversationsResponse {
  conversations: ConversationResponse[];
  meta: { nextToken?: string; pageSize?: number };
}

export interface ListParticipantsResponse {
  participants: ParticipantResponse[];
  meta: { nextToken?: string; pageSize?: number };
}

export interface ListCommunicationsResponse {
  communications: CommunicationResponse[];
  meta: { nextToken?: string; pageSize?: number };
}

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
  receivedAt?: string;
  operatorResults: Array<{
    id: string;
    operator: {
      id: string;
      displayName: string;
      version: number;
      parameters: unknown;
    };
    outputFormat: string;
    result: unknown;
    dateCreated: string;
    referenceIds: string[];
    metadata?: {
      system?: {
        latencyMs?: number;
        resolvedModel?: string;
      };
    };
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
        customerMemory: unknown;
        knowledge: {
          bases: unknown[];
        };
      };
    };
  }>;
}

// Conversation Memory Profile
export interface MemoraProfile {
  id: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  createdAt?: string;
}

// Customer Memory types
export interface MemoryObservation {
  id: string;
  content: string;
  source: string;
  occurredAt: string;
  conversationIds: string[];
  createdAt: string;
  score?: number;
}

export interface MemorySummary {
  id: string;
  conversationId: string;
  content: string;
  source: string;
  occurredAt: string;
  createdAt: string;
  score?: number;
}

export interface MemoryResult {
  observations: MemoryObservation[];
  allObservations: MemoryObservation[];
  summaries: MemorySummary[];
  profileId?: string;
  unconfigured?: boolean;
  error?: string;
}

// Database row types
export interface TranscriptRow {
  id: number;
  name: string;
  description: string | null;
  content: string;
  created_at: string;
}

export interface SimulatedCallRow {
  id: number;
  transcript_id: number;
  conversation_id: string | null;
  status?: string;
  created_at: string;
  updated_at: string;
}

export interface OperatorResultRow {
  id: number;
  simulated_call_id: number;
  conversation_id: string;
  payload: string;
  received_at: string;
}
