import type {
  ACPSessionUpdate,
  ACPPromptResult,
  ACPContent,
} from './types';
import { createLogger } from '../utils/logger';

const logger = createLogger('ACPSession');

/**
 * ACP 会话更新回调
 */
export type ACPSessionUpdateCallback = (update: ACPSessionUpdate) => void;

/**
 * ACP 会话封装
 * 管理单个会话的生命周期和消息交互
 */
export class ACPSession {
  private sessionId: string;
  private updateCallback: ACPSessionUpdateCallback | null = null;
  private abortController: AbortController | null = null;
  private isProcessing = false;

  // 连接相关（由 ACPClient 注入）
  private sendPrompt: ((
    sessionId: string,
    prompt: ACPContent[],
    onUpdate: ACPSessionUpdateCallback
  ) => Promise<ACPPromptResult>) | null = null;

  private sendCancel: ((sessionId: string) => Promise<void>) | null = null;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    logger.info('Session created', { sessionId });
  }

  /**
   * 注入连接方法（由 ACPClient 调用）
   */
  setConnection(
    sendPrompt: (
      sessionId: string,
      prompt: ACPContent[],
      onUpdate: ACPSessionUpdateCallback
    ) => Promise<ACPPromptResult>,
    sendCancel: (sessionId: string) => Promise<void>
  ): void {
    this.sendPrompt = sendPrompt;
    this.sendCancel = sendCancel;
  }

  /**
   * 发送 prompt 并等待完成
   * @param content 用户消息内容
   * @param onUpdate 更新回调（接收流式更新）
   * @returns prompt 结果
   */
  async prompt(
    content: string,
    onUpdate?: ACPSessionUpdateCallback
  ): Promise<ACPPromptResult> {
    if (!this.sendPrompt) {
      throw new Error('Session not connected');
    }

    if (this.isProcessing) {
      throw new Error('Session is already processing a prompt');
    }

    this.isProcessing = true;
    this.abortController = new AbortController();
    this.updateCallback = onUpdate || null;

    logger.debug('Sending prompt', {
      sessionId: this.sessionId,
      contentLength: content.length,
    });

    try {
      const result = await this.sendPrompt(
        this.sessionId,
        [{ type: 'text', text: content }],
        (update) => {
          // 只处理属于当前会话的更新
          if (update.sessionId === this.sessionId && this.updateCallback) {
            this.updateCallback(update);
          }
        }
      );

      logger.debug('Prompt completed', {
        sessionId: this.sessionId,
        stopReason: result.stopReason,
      });

      return result;
    } finally {
      this.isProcessing = false;
      this.abortController = null;
      this.updateCallback = null;
    }
  }

  /**
   * 取消当前进行中的 prompt
   */
  async cancel(): Promise<void> {
    if (!this.isProcessing) {
      logger.debug('No active prompt to cancel', { sessionId: this.sessionId });
      return;
    }

    if (!this.sendCancel) {
      throw new Error('Session not connected');
    }

    logger.info('Cancelling prompt', { sessionId: this.sessionId });
    await this.sendCancel(this.sessionId);
  }

  /**
   * 获取会话 ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * 检查是否正在处理 prompt
   */
  isActive(): boolean {
    return this.isProcessing;
  }

  /**
   * 销毁会话（清理资源）
   */
  destroy(): void {
    if (this.isProcessing && this.abortController) {
      this.abortController.abort();
    }
    this.sendPrompt = null;
    this.sendCancel = null;
    this.updateCallback = null;
    logger.info('Session destroyed', { sessionId: this.sessionId });
  }
}
