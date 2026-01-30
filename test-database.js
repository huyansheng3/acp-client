// 测试 DatabaseManager 功能
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

function testDatabaseManager() {
  console.log('=== DatabaseManager Test ===');
  
  // 使用内存数据库进行测试
  const dbPath = ':memory:';
  const db = new sqlite3.Database(dbPath);
  
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 创建表
      console.log('Creating tables...');
      
      // 会话表
      db.run(`
        CREATE TABLE conversations (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          createdAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL
        )
      `, (err) => {
        if (err) {
          console.error('Failed to create conversations table:', err);
          return reject(err);
        }
        console.log('✓ Conversations table created');
      });
      
      // 消息表
      db.run(`
        CREATE TABLE messages (
          id TEXT PRIMARY KEY,
          conversationId TEXT NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          model TEXT,
          inputTokens INTEGER,
          outputTokens INTEGER,
          createdAt INTEGER NOT NULL,
          FOREIGN KEY (conversationId) REFERENCES conversations(id)
        )
      `, (err) => {
        if (err) {
          console.error('Failed to create messages table:', err);
          return reject(err);
        }
        console.log('✓ Messages table created');
      });
      
      // 工具调用记录表
      db.run(`
        CREATE TABLE tool_calls (
          id TEXT PRIMARY KEY,
          messageId TEXT NOT NULL,
          conversationId TEXT NOT NULL,
          toolName TEXT NOT NULL,
          toolInput TEXT NOT NULL,
          toolOutput TEXT NOT NULL,
          createdAt INTEGER NOT NULL,
          FOREIGN KEY (messageId) REFERENCES messages(id),
          FOREIGN KEY (conversationId) REFERENCES conversations(id)
        )
      `, (err) => {
        if (err) {
          console.error('Failed to create tool_calls table:', err);
          return reject(err);
        }
        console.log('✓ Tool calls table created');
      });
      
      // 测试 CRUD 操作
      db.serialize(() => {
        console.log('\nTesting CRUD operations...');
        
        // 创建会话
        const conversationId = 'test-conversation-' + Date.now();
        const title = 'Test Conversation';
        const now = Date.now();
        
        db.run(`
          INSERT INTO conversations (id, title, createdAt, updatedAt)
          VALUES (?, ?, ?, ?)
        `, [conversationId, title, now, now], function(err) {
          if (err) {
            console.error('Failed to create conversation:', err);
            return reject(err);
          }
          console.log('✓ Conversation created:', conversationId);
        });
        
        // 创建消息
        const messageId = 'test-message-' + Date.now();
        db.run(`
          INSERT INTO messages (id, conversationId, role, content, model, inputTokens, outputTokens, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [messageId, conversationId, 'user', 'Hello, world!', 'sonnet', 10, 5, now], function(err) {
          if (err) {
            console.error('Failed to create message:', err);
            return reject(err);
          }
          console.log('✓ Message created:', messageId);
        });
        
        // 查询会话列表
        db.all('SELECT * FROM conversations', (err, rows) => {
          if (err) {
            console.error('Failed to query conversations:', err);
            return reject(err);
          }
          console.log('✓ Conversations query result:', rows.length, 'rows');
        });
        
        // 查询消息列表
        db.all('SELECT * FROM messages WHERE conversationId = ?', [conversationId], (err, rows) => {
          if (err) {
            console.error('Failed to query messages:', err);
            return reject(err);
          }
          console.log('✓ Messages query result:', rows.length, 'rows');
        });
        
        // 更新会话
        const newTitle = 'Updated Test Conversation';
        db.run('UPDATE conversations SET title = ?, updatedAt = ? WHERE id = ?', 
          [newTitle, Date.now(), conversationId], function(err) {
          if (err) {
            console.error('Failed to update conversation:', err);
            return reject(err);
          }
          console.log('✓ Conversation updated:', this.changes, 'rows affected');
        });
        
        // 删除消息
        db.run('DELETE FROM messages WHERE id = ?', [messageId], function(err) {
          if (err) {
            console.error('Failed to delete message:', err);
            return reject(err);
          }
          console.log('✓ Message deleted:', this.changes, 'rows affected');
        });
        
        // 删除会话
        db.run('DELETE FROM conversations WHERE id = ?', [conversationId], function(err) {
          if (err) {
            console.error('Failed to delete conversation:', err);
            return reject(err);
          }
          console.log('✓ Conversation deleted:', this.changes, 'rows affected');
        });
        
        // 测试完成
        setTimeout(() => {
          console.log('\n✓ All database operations completed successfully');
          db.close();
          resolve();
        }, 1000);
      });
    });
  });
}

testDatabaseManager().catch(console.error);