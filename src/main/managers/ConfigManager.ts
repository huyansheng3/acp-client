import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

/**
 * Claude 配置接口
 */
export interface ClaudeSettings {
  model?: string;
  env?: Record<string, string>;
  apiKeyHelper?: string;
  permissions?: {
    allow?: string[];
    deny?: string[];
    additionalDirectories?: string[];
    defaultMode?: string;
  };
}

/**
 * 配置管理器 - 读取 Claude Code 配置
 */
export class ConfigManager {
  private settingsPath: string;
  private settings: ClaudeSettings | null = null;

  constructor() {
    this.settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  }

  /**
   * 读取 Claude settings.json
   */
  readSettings(): ClaudeSettings {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const content = fs.readFileSync(this.settingsPath, 'utf-8');
        this.settings = JSON.parse(content);
        return this.settings!;
      }
    } catch (error) {
      console.error('Failed to read Claude settings:', error);
    }

    // 返回默认配置
    this.settings = {
      model: 'sonnet',
    };
    return this.settings;
  }

  /**
   * 获取 API Key 或 Auth Token
   * 优先级: 环境变量 > apiKeyHelper > settings.json
   */
  getApiKey(): string | undefined {
    // 1. 环境变量 - API Key
    if (process.env.ANTHROPIC_API_KEY) {
      return process.env.ANTHROPIC_API_KEY;
    }

    // 2. 环境变量 - Auth Token
    if (process.env.ANTHROPIC_AUTH_TOKEN) {
      return process.env.ANTHROPIC_AUTH_TOKEN;
    }

    // 3. apiKeyHelper 脚本
    const settings = this.getSettings();
    if (settings.apiKeyHelper) {
      const key = this.executeApiKeyHelper(settings.apiKeyHelper);
      if (key) return key;
    }

    // 4. settings.json 中的 env.ANTHROPIC_API_KEY
    if (settings.env?.ANTHROPIC_API_KEY) {
      return settings.env.ANTHROPIC_API_KEY;
    }

    // 5. settings.json 中的 env.ANTHROPIC_AUTH_TOKEN
    if (settings.env?.ANTHROPIC_AUTH_TOKEN) {
      return settings.env.ANTHROPIC_AUTH_TOKEN;
    }

    return undefined;
  }

  /**
   * 获取模型名称
   */
  getModel(): string {
    const settings = this.getSettings();
    return (
      process.env.ANTHROPIC_MODEL ||
      settings.model ||
      'sonnet'
    );
  }

  /**
   * 获取缓存的配置（避免重复读取文件）
   */
  private getSettings(): ClaudeSettings {
    if (!this.settings) {
      return this.readSettings();
    }
    return this.settings;
  }

  /**
   * 执行 apiKeyHelper 脚本获取 API Key
   */
  private executeApiKeyHelper(script: string): string | undefined {
    try {
      // 展开 ~ 路径
      const expandedScript = script.replace(/^~/, os.homedir());

      const result = execSync(expandedScript, {
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'ignore'], // 忽略 stderr
      });

      return result.trim();
    } catch (error) {
      console.error('Failed to execute apiKeyHelper:', error);
      return undefined;
    }
  }

  /**
   * 刷新配置（重新读取文件）
   */
  refresh(): ClaudeSettings {
    this.settings = null;
    return this.readSettings();
  }
}
