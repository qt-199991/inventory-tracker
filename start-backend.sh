#!/usr/bin/env bash
# 共享后端启动脚本（Linux / macOS / 云服务器通用）
set -e
cd "$(dirname "$0")/backend/node"
echo "============================================"
echo "  个人物品库存清单 —— 共享后端"
echo "============================================"
echo "  启动后浏览器打开： http://localhost:8080"
echo "  默认账号： admin / admin123"
echo "  数据文件： backend/node/data/inventory.json"
echo ""
echo "  生产环境建议用进程守护（如 systemd / pm2 / nohup）："
echo "    PORT=8080 nohup node server.mjs > server.log 2>&1 &"
echo "============================================"
node server.mjs
