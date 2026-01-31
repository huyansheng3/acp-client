/**
 * ACP (Agent Client Protocol) 类型定义
 * 基于 @agentclientprotocol/sdk
 */

/**
 * ACP Client 配置
 */
export interface ACPClientConfig {
  /** Agent 启动命令，默认 ['claude-code-acp'] */
  agentCommand?: string[];
  /** 工作目录 */
  workingDir?: string;
  /** 客户端信息 */
  clientInfo?: {
    name: string;
    version: string;
  };
  /** 注入到子进程的环境变量 */
  env?: Record<string, string>;
}

/**
 * ACP 会话配置
 */
export interface ACPSessionConfig {
  /** 会话 ID（可选，由 Agent 生成） */
  sessionId?: string;
}

/**
 * ACP 初始化参数
 */
export interface ACPInitializeParams {
  clientInfo: {
    name: string;
    version: string;
  };
  capabilities?: ACPClientCapabilities;
}

/**
 * ACP Client 能力声明
 */
export interface ACPClientCapabilities {
  /** 文件读取能力 */
  'fs.readTextFile'?: boolean;
  /** 文件写入能力 */
  'fs.writeTextFile'?: boolean;
  /** 终端能力 */
  terminal?: boolean;
}

/**
 * ACP 会话更新类型
 */
export type ACPSessionUpdateType =
  | 'agent_message_chunk'
  | 'user_message_chunk'
  | 'thought_message_chunk'
  | 'tool_call'
  | 'tool_call_update'
  | 'plan'
  | 'available_commands'
  | 'mode_change';

/**
 * ACP 会话更新
 */
export interface ACPSessionUpdate {
  sessionId: string;
  sessionUpdate: ACPSessionUpdateType;
  content?: ACPContent;
  toolCallId?: string;
  title?: string;
  kind?: string;
  status?: ACPToolCallStatus;
  entries?: ACPPlanEntry[];
}

/**
 * ACP 内容块
 */
export interface ACPContent {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
}

/**
 * ACP 工具调用状态
 */
export type ACPToolCallStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * ACP 计划条目
 */
export interface ACPPlanEntry {
  content: string;
  priority?: 'high' | 'medium' | 'low';
  status?: 'pending' | 'in_progress' | 'completed';
}

/**
 * ACP Prompt 结果
 */
export interface ACPPromptResult {
  stopReason: ACPStopReason;
}

/**
 * ACP 停止原因
 */
export type ACPStopReason =
  | 'end_turn'
  | 'max_tokens'
  | 'max_turn_requests'
  | 'refusal'
  | 'cancelled';

/**
 * ACP 权限请求
 */
export interface ACPPermissionRequest {
  sessionId: string;
  toolCallId: string;
  title: string;
  description?: string;
  kind: string;
  /** 工具调用的详细信息 */
  details?: Record<string, unknown>;
}

/**
 * ACP 权限响应
 */
export interface ACPPermissionResponse {
  toolCallId: string;
  granted: boolean;
}

/**
 * ACP 连接状态
 */
export type ACPConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

/**
 * ACP 错误
 */
export interface ACPError {
  code: number;
  message: string;
  data?: unknown;
}
