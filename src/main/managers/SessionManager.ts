import { ClaudeCodeProcess, ClaudeConfig } from '../claude/ClaudeCodeProcess';

/**
 * 会话管理器 - 管理多个独立的 Claude Code 进程
 */
export class SessionManager {
  private sessions: Map<string, ClaudeCodeProcess> = new Map();
  private defaultConfig: ClaudeConfig;

  constructor(defaultConfig: ClaudeConfig) {
    this.defaultConfig = defaultConfig;
  }

  /**
   * 创建新会话
   * @param conversationId 会话 ID
   * @param config 可选的会话级配置
   * @returns Claude Code 进程实例
   */
  createSession(
    conversationId: string,
    config?: Partial<ClaudeConfig>
  ): ClaudeCodeProcess {
    // 合并配置
    const mergedConfig = {
      ...this.defaultConfig,
      ...config,
    };

    const session = new ClaudeCodeProcess(conversationId, mergedConfig);
    this.sessions.set(conversationId, session);

    console.log(`Created session for conversation: ${conversationId}`);
    return session;
  }

  /**
   * 获取会话
   * @param conversationId 会话 ID
   * @returns Claude Code 进程实例或 undefined
   */
  getSession(conversationId: string): ClaudeCodeProcess | undefined {
    return this.sessions.get(conversationId);
  }

  /**
   * 获取或创建会话
   * @param conversationId 会话 ID
   * @returns Claude Code 进程实例
   */
  getOrCreateSession(conversationId: string): ClaudeCodeProcess {
    console.log('[SessionManager] getOrCreateSession:', conversationId);
    let session = this.sessions.get(conversationId);
    if (!session) {
      console.log('[SessionManager] Session not found, creating new session');
      session = this.createSession(conversationId);
    } else {
      console.log('[SessionManager] Reusing existing session');
    }
    if (!session) {
      console.error('[SessionManager] Failed to create session');
      throw new Error('Failed to create session');
    }
    return session;
  }

  /**
   * 销毁会话
   * @param conversationId 会话 ID
   */
  destroySession(conversationId: string): void {
    const session = this.sessions.get(conversationId);
    if (session) {
      session.destroy();
      this.sessions.delete(conversationId);
      console.log(`Destroyed session for conversation: ${conversationId}`);
    }
  }

  /**
   * 销毁所有会话
   */
  destroyAll(): void {
    console.log(`Destroying all ${this.sessions.size} sessions...`);
    this.sessions.forEach((session) => session.destroy());
    this.sessions.clear();
  }

  /**
   * 获取当前活跃会话数量
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * 获取所有活跃会话 ID
   */
  getActiveSessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }
}
