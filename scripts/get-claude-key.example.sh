#!/bin/bash
# 示例脚本：从系统密钥链获取 Claude API Key
# macOS 示例（需要先保存密钥到钥匙串）

# 用法：
# 1. 保存密钥到钥匙串：
#    security add-generic-password -a "$USER" -s "claude-api-key" -w "sk-ant-api03-..."
#
# 2. 在 ~/.claude/settings.json 中配置：
#    "apiKeyHelper": "~/scripts/get-claude-key.sh"

# 从钥匙串读取密钥
security find-generic-password -a "$USER" -s "claude-api-key" -w
