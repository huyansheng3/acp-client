#!/usr/bin/env node

/**
 * 日志读取工具
 * 用于从固定目录读取和分析日志文件
 * 
 * 使用方法:
 *   node scripts/read-logs.js                    # 读取今天的合并日志
 *   node scripts/read-logs.js --source main      # 读取主进程日志
 *   node scripts/read-logs.js --source renderer  # 读取渲染进程日志
 *   node scripts/read-logs.js --lines 200        # 读取最后 200 行
 *   node scripts/read-logs.js --list             # 列出所有日志文件
 *   node scripts/read-logs.js --date 2026-01-30  # 读取指定日期日志
 *   node scripts/read-logs.js --filter ERROR     # 过滤包含 ERROR 的行
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// 获取日志目录 (与 Electron app 保持一致)
function getLogDirectory() {
  const platform = process.platform;
  let userDataPath;

  if (platform === 'darwin') {
    userDataPath = path.join(os.homedir(), 'Library', 'Application Support', 'ElectronReact');
  } else if (platform === 'win32') {
    userDataPath = path.join(process.env.APPDATA || '', 'ElectronReact');
  } else {
    userDataPath = path.join(os.homedir(), '.config', 'ElectronReact');
  }

  return path.join(userDataPath, 'logs');
}

// 获取今天的日期字符串
function getDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 解析命令行参数
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    source: 'combined', // main, renderer, combined
    lines: 100,
    list: false,
    date: getDateString(),
    filter: null,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--list' || arg === '-l') {
      options.list = true;
    } else if (arg === '--source' || arg === '-s') {
      options.source = args[++i];
    } else if (arg === '--lines' || arg === '-n') {
      options.lines = parseInt(args[++i], 10);
    } else if (arg === '--date' || arg === '-d') {
      options.date = args[++i];
    } else if (arg === '--filter' || arg === '-f') {
      options.filter = args[++i];
    }
  }

  return options;
}

// 显示帮助信息
function showHelp() {
  console.log(`
日志读取工具 - Electron 应用日志分析

使用方法:
  node scripts/read-logs.js [选项]

选项:
  -s, --source <type>   日志来源: main, renderer, combined (默认: combined)
  -n, --lines <number>  读取行数 (默认: 100)
  -d, --date <date>     日期 YYYY-MM-DD (默认: 今天)
  -f, --filter <text>   过滤包含指定文本的行
  -l, --list            列出所有日志文件
  -h, --help            显示帮助信息

示例:
  node scripts/read-logs.js                          # 读取今天的合并日志
  node scripts/read-logs.js -s main -n 200           # 读取主进程最后 200 行
  node scripts/read-logs.js -f ERROR                 # 过滤错误日志
  node scripts/read-logs.js -d 2026-01-30 -s renderer # 读取指定日期渲染进程日志
`);
}

// 列出所有日志文件
function listLogFiles(logDir) {
  if (!fs.existsSync(logDir)) {
    console.log('日志目录不存在:', logDir);
    return;
  }

  const files = fs.readdirSync(logDir)
    .filter(f => f.endsWith('.log'))
    .sort()
    .reverse();

  console.log('日志目录:', logDir);
  console.log('');
  console.log('日志文件:');
  
  if (files.length === 0) {
    console.log('  (无日志文件)');
    return;
  }

  files.forEach(file => {
    const filePath = path.join(logDir, file);
    const stats = fs.statSync(filePath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    console.log(`  ${file} (${sizeKB} KB)`);
  });
}

// 读取日志文件
function readLogs(logDir, options) {
  const logFile = path.join(logDir, `${options.source}-${options.date}.log`);

  if (!fs.existsSync(logFile)) {
    console.log(`日志文件不存在: ${logFile}`);
    console.log('');
    console.log('提示: 使用 --list 查看可用的日志文件');
    return;
  }

  const content = fs.readFileSync(logFile, 'utf-8');
  let lines = content.split('\n');

  // 过滤
  if (options.filter) {
    lines = lines.filter(line => line.includes(options.filter));
    console.log(`[过滤: "${options.filter}", 匹配 ${lines.length} 行]`);
    console.log('');
  }

  // 取最后 N 行
  const recentLines = lines.slice(-options.lines);

  console.log(`日志文件: ${logFile}`);
  console.log(`显示最后 ${Math.min(options.lines, recentLines.length)} 行:`);
  console.log('='.repeat(80));
  console.log(recentLines.join('\n'));
  console.log('='.repeat(80));
}

// 主函数
function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    return;
  }

  const logDir = getLogDirectory();

  if (options.list) {
    listLogFiles(logDir);
    return;
  }

  readLogs(logDir, options);
}

main();
