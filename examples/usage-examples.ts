/**
 * 示例：如何使用 ClaudeCodeProcess 和 SessionManager
 */

import { ClaudeCodeProcess, ClaudeConfig } from './src/main/claude/ClaudeCodeProcess';
import { SessionManager } from './src/main/managers/SessionManager';
import { ConfigManager } from './src/main/managers/ConfigManager';

// ============================================
// 示例 1: 直接使用 ClaudeCodeProcess
// ============================================

async function example1_directUsage() {
  console.log('=== 示例 1: 直接使用 ClaudeCodeProcess ===\n');

  // 配置
  const config: ClaudeConfig = {
    model: 'sonnet',
    systemPrompt: 'You are a helpful AI assistant.',
  };

  // 创建进程
  const session = new ClaudeCodeProcess('test-session-1', config);

  // 发送消息（流式输出）
  console.log('发送消息: "Hello, Claude!"');
  const response = await session.sendMessage('Hello, Claude!', (chunk) => {
    process.stdout.write(chunk); // 实时输出
  });

  console.log('\n\n完整响应:', response);
  console.log('\n---\n');

  // 清理资源
  session.destroy();
}

// ============================================
// 示例 2: 使用 SessionManager 管理多会话
// ============================================

async function example2_sessionManager() {
  console.log('=== 示例 2: 使用 SessionManager 管理多会话 ===\n');

  // 读取配置
  const configManager = new ConfigManager();
  const settings = configManager.readSettings();
  const apiKey = configManager.getApiKey();

  console.log('读取配置:', {
    model: settings.model,
    hasApiKey: !!apiKey,
  });

  // 创建 SessionManager
  const defaultConfig: ClaudeConfig = {
    model: settings.model || 'sonnet',
    apiKey: apiKey,
  };

  const sessionManager = new SessionManager(defaultConfig);

  // 创建多个会话
  const session1 = sessionManager.createSession('conversation-1');
  const session2 = sessionManager.createSession('conversation-2', {
    systemPrompt: 'You are a coding expert.',
  });

  console.log(`活跃会话数: ${sessionManager.getActiveSessionCount()}`);
  console.log(`会话 ID 列表:`, sessionManager.getActiveSessionIds());
  console.log('\n');

  // 会话 1 发送消息
  console.log('[会话1] 发送消息...');
  await session1.sendMessage('What is 2+2?', (chunk) => {
    process.stdout.write(chunk);
  });
  console.log('\n\n');

  // 会话 2 发送消息
  console.log('[会话2] 发送消息...');
  await session2.sendMessage('Write a hello world in Python', (chunk) => {
    process.stdout.write(chunk);
  });
  console.log('\n\n');

  // 清理所有会话
  sessionManager.destroyAll();
  console.log('所有会话已销毁\n');
  console.log('---\n');
}

// ============================================
// 示例 3: 消息注入（人工干预）
// ============================================

async function example3_messageInjection() {
  console.log('=== 示例 3: 消息注入（人工干预） ===\n');

  const config: ClaudeConfig = {
    model: 'sonnet',
  };

  const session = new ClaudeCodeProcess('test-session-3', config);

  // 发送第一条消息
  console.log('发送消息: "Count from 1 to 100"');
  const promise = session.sendMessage('Count from 1 to 100', (chunk) => {
    process.stdout.write(chunk);
  });

  // 模拟在 Claude 响应过程中注入消息（人工干预）
  setTimeout(async () => {
    try {
      console.log('\n\n[注入] 停止计数，改为问候语\n');
      await session.injectMessage('Stop counting. Just say hello instead.');
    } catch (error) {
      console.error('注入失败:', error);
    }
  }, 2000);

  await promise;
  console.log('\n\n---\n');

  session.destroy();
}

// ============================================
// 示例 4: 错误处理
// ============================================

async function example4_errorHandling() {
  console.log('=== 示例 4: 错误处理 ===\n');

  const config: ClaudeConfig = {
    model: 'sonnet',
    apiKey: 'invalid-key', // 故意使用无效 Key
  };

  const session = new ClaudeCodeProcess('test-session-4', config);

  try {
    await session.sendMessage('Hello', (chunk) => {
      process.stdout.write(chunk);
    });
  } catch (error) {
    console.error('捕获到错误:', error.message);
  }

  console.log('\n---\n');

  session.destroy();
}

// ============================================
// 示例 5: 多 Provider 配置
// ============================================

async function example5_multiProvider() {
  console.log('=== 示例 5: 多 Provider 配置 ===\n');

  // 配置 1: 使用 Anthropic API (默认)
  const anthropicConfig: ClaudeConfig = {
    model: 'sonnet',
    provider: 'anthropic',
  };

  // 配置 2: 使用 Amazon Bedrock
  // 需要设置环境变量：
  // export AWS_REGION="us-west-2"
  // export AWS_ACCESS_KEY_ID="..."
  // export AWS_SECRET_ACCESS_KEY="..."
  const bedrockConfig: ClaudeConfig = {
    model: 'sonnet',
    provider: 'amazon-bedrock',
  };

  // 配置 3: 使用 Google Vertex AI
  // 需要设置环境变量：
  // export GOOGLE_VERTEX_PROJECT_ID="..."
  // export GOOGLE_VERTEX_LOCATION="us-central1"
  // export GOOGLE_APPLICATION_CREDENTIALS="/path/to/credentials.json"
  const vertexConfig: ClaudeConfig = {
    model: 'sonnet',
    provider: 'google-vertex',
  };

  console.log('Provider 配置示例:');
  console.log('1. Anthropic:', anthropicConfig);
  console.log('2. Amazon Bedrock:', bedrockConfig);
  console.log('3. Google Vertex AI:', vertexConfig);
  console.log('\n注意：需要配置相应的环境变量\n');
  console.log('---\n');
}

// ============================================
// 运行所有示例
// ============================================

async function runAllExamples() {
  console.log('\n🚀 Claude Code Process 使用示例\n');
  console.log('=' .repeat(60));
  console.log('\n');

  try {
    // 运行示例 1
    await example1_directUsage();

    // 运行示例 2
    await example2_sessionManager();

    // 运行示例 3（注释掉，因为涉及异步注入）
    // await example3_messageInjection();

    // 运行示例 4（注释掉，因为会产生错误）
    // await example4_errorHandling();

    // 运行示例 5
    await example5_multiProvider();

    console.log('✅ 所有示例运行完成\n');
  } catch (error) {
    console.error('❌ 示例运行失败:', error);
  }
}

// 运行示例
if (require.main === module) {
  runAllExamples();
}

export {
  example1_directUsage,
  example2_sessionManager,
  example3_messageInjection,
  example4_errorHandling,
  example5_multiProvider,
};
