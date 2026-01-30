import path from 'path';
import { app } from 'electron';
import sqlite3 from 'sqlite3';
import { Conversation, Message, ToolCall } from '../../types/conversation';

const sqlite = sqlite3.verbose();

/**
 * 数据库管理器 - 处理 SQLite 数据持久化
 */
export class DatabaseManager {
  private db: sqlite3.Database | null = null;
  private dbPath: string;

  constructor() {
    const isDebug =
      process.env.NODE_ENV === 'development' ||
      process.env.DEBUG_PROD === 'true';

    // 开发模式：存储在项目目录
    // 生产模式：存储在用户数据目录
    const databaseName = 'acp-client.sqlite';
    this.dbPath = isDebug
      ? path.join(__dirname, '../../sql', databaseName)
      : path.join(app.getPath('userData'), databaseName);
  }

  /**
   * 初始化数据库连接和表结构
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new sqlite.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Database opening error: ', err);
          reject(err);
          return;
        }

        // 创建表结构
        this.createTables()
          .then(() => resolve())
          .catch((error) => reject(error));
      });
    });
  }

  /**
   * 创建数据库表
   */
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.serialize(() => {
        // 会话表
        this.db!.run(
          `CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            status TEXT DEFAULT 'active',
            claude_session_id TEXT
          )`,
          (err) => {
            if (err) {
              reject(err);
              return;
            }
          }
        );

        // 消息表
        this.db!.run(
          `CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT,
            created_at INTEGER NOT NULL,
            metadata TEXT,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
          )`,
          (err) => {
            if (err) {
              reject(err);
              return;
            }
          }
        );

        // 工具调用记录表
        this.db!.run(
          `CREATE TABLE IF NOT EXISTS tool_calls (
            id TEXT PRIMARY KEY,
            message_id TEXT NOT NULL,
            tool_name TEXT NOT NULL,
            input TEXT,
            output TEXT,
            status TEXT DEFAULT 'pending',
            created_at INTEGER NOT NULL,
            FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
          )`,
          (err) => {
            if (err) {
              reject(err);
              return;
            }
          }
        );

        // 创建索引
        this.db!.run(
          'CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)'
        );
        this.db!.run(
          'CREATE INDEX IF NOT EXISTS idx_tool_calls_message ON tool_calls(message_id)'
        );
        this.db!.run(
          'CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC)',
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    });
  }

  /**
   * 创建会话
   */
  async createConversation(conversation: Conversation): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.run(
        `INSERT INTO conversations (id, title, created_at, updated_at, status, claude_session_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          conversation.id,
          conversation.title,
          conversation.createdAt,
          conversation.updatedAt,
          conversation.status,
          conversation.claudeSessionId || null,
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  /**
   * 获取所有会话
   */
  async getConversations(): Promise<Conversation[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.all(
        'SELECT * FROM conversations ORDER BY updated_at DESC',
        (err, rows: any[]) => {
          if (err) {
            reject(err);
            return;
          }

          const conversations: Conversation[] = rows.map((row) => ({
            id: row.id,
            title: row.title,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            status: row.status,
            claudeSessionId: row.claude_session_id,
          }));

          resolve(conversations);
        }
      );
    });
  }

  /**
   * 更新会话
   */
  async updateConversation(
    id: string,
    updates: Partial<Conversation>
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.title !== undefined) {
      fields.push('title = ?');
      values.push(updates.title);
    }
    if (updates.updatedAt !== undefined) {
      fields.push('updated_at = ?');
      values.push(updates.updatedAt);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.claudeSessionId !== undefined) {
      fields.push('claude_session_id = ?');
      values.push(updates.claudeSessionId);
    }

    if (fields.length === 0) return;

    values.push(id);

    return new Promise((resolve, reject) => {
      this.db!.run(
        `UPDATE conversations SET ${fields.join(', ')} WHERE id = ?`,
        values,
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  /**
   * 删除会话
   */
  async deleteConversation(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.run('DELETE FROM conversations WHERE id = ?', [id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * 创建消息
   */
  async createMessage(message: Message): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.run(
        `INSERT INTO messages (id, conversation_id, role, content, created_at, metadata)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          message.id,
          message.conversationId,
          message.role,
          message.content,
          message.createdAt,
          message.metadata ? JSON.stringify(message.metadata) : null,
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  /**
   * 获取会话的所有消息
   */
  async getMessages(conversationId: string): Promise<Message[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.all(
        'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
        [conversationId],
        (err, rows: any[]) => {
          if (err) {
            reject(err);
            return;
          }

          const messages: Message[] = rows.map((row) => ({
            id: row.id,
            conversationId: row.conversation_id,
            role: row.role,
            content: row.content,
            createdAt: row.created_at,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
          }));

          resolve(messages);
        }
      );
    });
  }

  /**
   * 创建工具调用记录
   */
  async createToolCall(toolCall: ToolCall): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.run(
        `INSERT INTO tool_calls (id, message_id, tool_name, input, output, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          toolCall.id,
          toolCall.messageId,
          toolCall.toolName,
          JSON.stringify(toolCall.input),
          toolCall.output ? JSON.stringify(toolCall.output) : null,
          toolCall.status,
          toolCall.createdAt,
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  /**
   * 获取消息的所有工具调用
   */
  async getToolCalls(messageId: string): Promise<ToolCall[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.all(
        'SELECT * FROM tool_calls WHERE message_id = ? ORDER BY created_at ASC',
        [messageId],
        (err, rows: any[]) => {
          if (err) {
            reject(err);
            return;
          }

          const toolCalls: ToolCall[] = rows.map((row) => ({
            id: row.id,
            messageId: row.message_id,
            toolName: row.tool_name,
            input: JSON.parse(row.input),
            output: row.output ? JSON.parse(row.output) : undefined,
            status: row.status,
            createdAt: row.created_at,
          }));

          resolve(toolCalls);
        }
      );
    });
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        }
      });
      this.db = null;
    }
  }
}
