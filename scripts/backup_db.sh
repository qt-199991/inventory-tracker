#!/usr/bin/env bash
# ==========================================================================
#  inventory 数据库定时备份脚本
#  用法: bash /opt/inventory/scripts/backup_db.sh
#  建议: 加入 crontab 每日 03:00 执行
# ==========================================================================
set -euo pipefail

BACKUP_DIR="/opt/inventory/backups"
DB_NAME="inventory"
DB_USER="inv_user"
DB_PASS="Inv@Passw0rd2026!"      # 建议改为从环境变量读取，避免明文
KEEP_DAYS=30                     # 本地保留天数

mkdir -p "$BACKUP_DIR"

DATE=$(date +%Y%m%d_%H%M%S)
OUT_FILE="${BACKUP_DIR}/${DB_NAME}_${DATE}.sql.gz"

# --single-transaction 保证一致性且不加锁，适合小中型库
mysqldump -u"$DB_USER" -p"$DB_PASS" \
  --single-transaction --routines --events --triggers \
  "$DB_NAME" | gzip > "$OUT_FILE"

# 清理超期备份
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +"$KEEP_DAYS" -delete

# 输出校验信息
SIZE=$(du -h "$OUT_FILE" | cut -f1)
echo "[$(date '+%F %T')] backup OK -> $OUT_FILE ($SIZE), keep $KEEP_DAYS days"
