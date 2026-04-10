import type { PersonaType, PersonaPhase } from '../enums.js';

export interface PersonaDefinition {
  id: string;
  name: string;
  personaType: PersonaType;
  phase: PersonaPhase;
  model: string;
  description: string | null;
  systemPrompt: string;
  maxConcurrent: number;
  color: string;
  canPush: boolean;
  canTransition: string[];
  gatekeeperTransitions: GatekeeperTransition[];
  config: Record<string, unknown>;
}

export interface GatekeeperTransition {
  from: string;
  to: string;
}
