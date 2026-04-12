/**
 * NDJSON protocol for backend <-> agent-runtime communication.
 * Each message is a single JSON object terminated by \n.
 */

// -- Requests (backend -> agent-runtime) --

export type SessionType = 'planning' | 'execution' | 'scan';

export interface SpawnSessionRequest {
  type: 'spawn_session';
  id: string; // request correlation id
  payload: {
    sessionId: string;
    sessionType: SessionType;
    personaType: string;
    model: string;
    prompt: string;
    workingDirectory: string;
    contextFiles?: string[];
    addDirs?: string[];
    name?: string;
    interactive?: boolean;
    systemContext?: string;
    /** MCP server context — when provided, agent gets structured tools via MCP. */
    mcpContext?: {
      sessionId: string;
      projectId: string;
      featureId: string;
      ticketId?: string;
      userId: string;
      authToken: string;
      apiBaseUrl?: string;
      phase: 'planning' | 'execution';
    };
  };
}

export interface SendPromptRequest {
  type: 'send_prompt';
  id: string;
  payload: {
    sessionId: string;
    prompt: string;
  };
}

export interface KillSessionRequest {
  type: 'kill_session';
  id: string;
  payload: {
    sessionId: string;
  };
}

export interface ListSessionsRequest {
  type: 'list_sessions';
  id: string;
}

export interface GetSessionStatusRequest {
  type: 'get_session_status';
  id: string;
  payload: {
    sessionId: string;
  };
}

export interface WriteToSessionRequest {
  type: 'write_to_session';
  id: string;
  payload: {
    sessionId: string;
    data: string;
  };
}

export interface ResizeSessionRequest {
  type: 'resize_session';
  id: string;
  payload: {
    sessionId: string;
    cols: number;
    rows: number;
  };
}

export interface GetSessionBufferRequest {
  type: 'get_session_buffer';
  id: string;
  payload: {
    sessionId: string;
  };
}

export type RuntimeRequest =
  | SpawnSessionRequest
  | SendPromptRequest
  | KillSessionRequest
  | ListSessionsRequest
  | GetSessionStatusRequest
  | WriteToSessionRequest
  | ResizeSessionRequest
  | GetSessionBufferRequest;

// -- Responses (agent-runtime -> backend) --

export interface SuccessResponse {
  type: 'response';
  id: string; // correlation id from request
  ok: true;
  data?: unknown;
}

export interface ErrorResponse {
  type: 'response';
  id: string;
  ok: false;
  error: string;
}

export type RuntimeResponse = SuccessResponse | ErrorResponse;

// -- Events (agent-runtime -> backend, unsolicited) --

export interface SessionActivityEvent {
  type: 'event';
  event: 'session:activity';
  payload: {
    sessionId: string;
    activity: 'busy' | 'waiting' | 'idle';
  };
}

export interface SessionOutputEvent {
  type: 'event';
  event: 'session:output';
  payload: {
    sessionId: string;
    chunk: string;
  };
}

export interface SessionStartedEvent {
  type: 'event';
  event: 'session:started';
  payload: {
    sessionId: string;
    personaType: string;
    ptyInstanceId: string;
  };
}

export interface SessionCompletedEvent {
  type: 'event';
  event: 'session:completed';
  payload: {
    sessionId: string;
    exitCode: number | null;
    outputSummary: string | null;
  };
}

export interface SessionErrorEvent {
  type: 'event';
  event: 'session:error';
  payload: {
    sessionId: string;
    error: string;
  };
}

export type RuntimeEvent =
  | SessionActivityEvent
  | SessionOutputEvent
  | SessionStartedEvent
  | SessionCompletedEvent
  | SessionErrorEvent;

export type RuntimeMessage = RuntimeRequest | RuntimeResponse | RuntimeEvent;

// -- Session info --

export interface SessionInfo {
  sessionId: string;
  sessionType: SessionType;
  personaType: string;
  model: string;
  ptyInstanceId: string;
  activity: 'busy' | 'waiting' | 'idle';
  status: 'starting' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt: string | null;
}
