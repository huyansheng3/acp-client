import Anthropic from '@anthropic-ai/sdk';
import { createLogger } from '../utils/logger';

const logger = createLogger('ClaudeCodeProcess');

/**
 * Claude Code 进程配置
 */
export interface ClaudeConfig {
  model?: string;
  systemPrompt?: string;
  apiKey?: string;
  authToken?: string;
  baseUrl?: string;
  provider?: string;
}

/**
 * Claude Code 进程管理类
 * 使用 Anthropic SDK 与 Claude API 通信
 * 每个会话对应一个独立的实例
 */
export class ClaudeCodeProcess {
  private sessionId: string;
  private config: ClaudeConfig;
  private client: Anthropic | null = null;
  private conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [];

  constructor(sessionId: string, config: ClaudeConfig) {
    this.sessionId = sessionId;
    this.config = config;
    logger.info('Constructor', { sessionId, model: config.model });
  }

  /**
   * 获取或创建 Anthropic 客户端
   */
  private getClient(): Anthropic {
    if (this.client) {
      return this.client;
    }

    logger.debug('Creating Anthropic client', { sessionId: this.sessionId });

    // 优先使用配置中的值，然后是环境变量
    const apiKey = this.config.apiKey || process.env.ANTHROPIC_API_KEY;
    const authToken = this.config.authToken || process.env.ANTHROPIC_AUTH_TOKEN;
    const baseUrl = this.config.baseUrl || process.env.ANTHROPIC_BASE_URL;

    logger.debug('Auth config', {
      hasApiKey: !!apiKey,
      hasAuthToken: !!authToken,
      baseUrl: baseUrl || 'default',
    });

    // 构建客户端配置
    const clientConfig: any = {};

    // 设置 base URL（如果有）
    if (baseUrl) {
      clientConfig.baseURL = baseUrl;
    }

    // 认证方式：apiKey 或 authToken
    if (apiKey) {
      clientConfig.apiKey = apiKey;
    } else if (authToken) {
      // 对于 authToken，需要设置为 Bearer token
      clientConfig.apiKey = authToken;
    }

    if (!clientConfig.apiKey) {
      logger.error('No API key or auth token provided');
      throw new Error('No API key or auth token configured. Please set ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN in ~/.claude/settings.json');
    }

    this.client = new Anthropic(clientConfig);

    logger.debug('Anthropic client created successfully');
    return this.client;
  }

  /**
   * 发送消息并获取流式响应
   * @param prompt 用户输入
   * @param onChunk 流式数据回调
   * @returns 完整响应文本
   */
  async sendMessage(
    prompt: string,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    logger.info('sendMessage START', {
      sessionId: this.sessionId,
      promptLength: prompt.length,
      historyLength: this.conversationHistory.length,
    });

    try {
      const client = this.getClient();

      // 添加用户消息到历史
      this.conversationHistory.push({
        role: 'user',
        content: prompt,
      });

      const model = this.config.model || 'claude-sonnet-4-20250514';
      const systemPrompt = this.config.systemPrompt || 'You are a helpful AI assistant.';

      logger.info('Calling Anthropic API with stream', {
        model,
        messagesCount: this.conversationHistory.length,
      });

      // 使用流式 API
      const stream = await client.messages.stream({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: this.conversationHistory,
      });

      let fullText = '';
      let chunkCount = 0;

      logger.debug('Starting to process stream');

      for await (const event of stream) {
        if (event.type === 'content_block_delta') {
          const delta = event.delta;
          if ('text' in delta) {
            chunkCount++;
            const text = delta.text;
            fullText += text;
            onChunk(text);

            if (chunkCount % 10 === 0) {
              logger.debug('Stream progress', {
                chunkCount,
                fullTextLength: fullText.length,
              });
            }
          }
        }
      }

      logger.info('Stream completed', {
        fullTextLength: fullText.length,
        chunkCount,
      });

      // 添加助手响应到历史
      this.conversationHistory.push({
        role: 'assistant',
        content: fullText,
      });

      logger.info('sendMessage DONE');
      return fullText;
    } catch (error) {
      logger.error('Error in sendMessage', error);
      
      // 移除失败的用户消息
      this.conversationHistory.pop();
      
      throw error;
    }
  }

  /**
   * 中途注入消息（模拟实现）
   * @param message 要注入的消息
   */
  async injectMessage(message: string): Promise<void> {
    logger.debug('injectMessage', { message });
    // 对于标准 Anthropic SDK，注入消息意味着在下一次请求时添加上下文
    this.conversationHistory.push({
      role: 'user',
      content: `[System Injection] ${message}`,
    });
  }

  /**
   * 销毁进程（释放资源）
   */
  destroy(): void {
    this.client = null;
    this.conversationHistory = [];
    logger.info('Session destroyed', { sessionId: this.sessionId });
  }

  /**
   * 获取会话 ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * 清除对话历史
   */
  clearHistory(): void {
    this.conversationHistory = [];
    logger.debug('Cleared history', { sessionId: this.sessionId });
  }
}
