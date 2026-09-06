export type CommandAction =
  | { type: "shell"; cmd: string; args: string[] }
  | { type: "workflow"; steps: string[] }
  | { type: "open"; path: string };

export interface DevFlowCommand {
  id: string;
  title: string;
  subtitle?: string;
  keywords: string[];
  action: CommandAction;
  isCustom: boolean;
  useCount: number;
  lastUsedAt?: number;
  createdAt: number;
}
