/**
 * IPC 通信通道定义
 */
export enum IPCChannel {
  // 会话管理
  CONVERSATION_CREATE = 'conversation:create',
  CONVERSATION_LIST = 'conversation:list',
  CONVERSATION_DELETE = 'conversation:delete',
  CONVERSATION_UPDATE = 'conversation:update',

  // 消息
  MESSAGE_SEND = 'message:send',
  MESSAGE_LIST = 'message:list',
  MESSAGE_STREAM = 'message:stream', // 流式响应

  // ACP 进程管理
  ACP_CANCEL = 'acp:cancel',

  // ACP 事件
  ACP_SESSION_UPDATE = 'acp:session:update',
  ACP_TOOL_CALL = 'acp:tool:call',
  ACP_TOOL_CALL_UPDATE = 'acp:tool:call:update',
  ACP_PERMISSION_REQUEST = 'acp:permission:request',
  ACP_PERMISSION_RESPONSE = 'acp:permission:response',

  // 配置
  CONFIG_GET = 'config:get',
  CONFIG_SET = 'config:set',

  // 日志
  LOG_WRITE = 'log:write',
  LOG_LIST = 'log:list',
  LOG_READ = 'log:read',
  LOG_GET_DIR = 'log:getDir',
}
