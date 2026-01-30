// 测试配置管理器
const path = require('path');
const os = require('os');

// 模拟 ConfigManager 的配置读取逻辑
function getConfigPath() {
  const homeDir = os.homedir();
  return path.join(homeDir, '.claude', 'settings.json');
}

function loadConfig() {
  const configPath = getConfigPath();
  console.log('Config path:', configPath);
  
  try {
    const fs = require('fs');
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    console.log('Config loaded successfully:');
    console.log('- model:', config.model);
    console.log('- env keys:', Object.keys(config.env || {}));
    console.log('- permissions:', config.permissions);
    return config;
  } catch (error) {
    console.error('Failed to load config:', error.message);
    return null;
  }
}

function getApiKey(config) {
  // 模拟 ConfigManager 的 API Key 获取逻辑
  // 优先级：环境变量 > apiKeyHelper > settings.json
  const envKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN;
  if (envKey) {
    console.log('Using API Key from environment variable:', envKey.substring(0, 20) + '...');
    return envKey;
  }
  
  if (config && config.env) {
    const configKey = config.env.ANTHROPIC_API_KEY || config.env.ANTHROPIC_AUTH_TOKEN;
    if (configKey) {
      console.log('Using API Key from config file:', configKey.substring(0, 20) + '...');
      return configKey;
    }
  }
  
  console.log('No API Key found');
  return null;
}

// 运行测试
console.log('=== Config Manager Test ===');
const config = loadConfig();
if (config) {
  const apiKey = getApiKey(config);
  console.log('Final API Key:', apiKey ? 'Found' : 'Not found');
}