// 测试 ConfigManager 的完整功能
const { ConfigManager } = require('./src/main/managers/ConfigManager');

async function testConfigManager() {
  console.log('=== ConfigManager Test ===');
  
  try {
    const configManager = new ConfigManager();
    console.log('ConfigManager created successfully');
    
    // 测试刷新配置
    const config = await configManager.refreshConfig();
    console.log('Config refreshed:');
    console.log('- model:', config.model);
    console.log('- env keys:', Object.keys(config.env || {}));
    console.log('- permissions:', config.permissions);
    
    // 测试获取 API Key
    const apiKey = await configManager.getApiKey();
    console.log('API Key:', apiKey ? 'Found' : 'Not found');
    
    // 测试获取配置
    const finalConfig = await configManager.getConfig();
    console.log('Final config:', finalConfig);
    
  } catch (error) {
    console.error('ConfigManager test failed:', error.message);
  }
}

testConfigManager();