/**
 * ACP (Agent Client Protocol) 模块
 * 
 * 提供与 Claude Code Agent 进行 ACP 协议通信的能力
 */

export { ACPClient } from './ACPClient';
export { ACPSession } from './ACPSession';
export type {
  ACPClientConfig,
  ACPSessionConfig,
  ACPSessionUpdate,
  ACPSessionUpdateType,
  ACPContent,
  ACPPromptResult,
  ACPStopReason,
  ACPToolCallStatus,
  ACPPlanEntry,
  ACPPermissionRequest,
  ACPPermissionResponse,
  ACPConnectionState,
  ACPError,
} from './types';
