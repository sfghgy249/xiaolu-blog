#!/bin/bash
# ============================================================
# 文章定时更新入口（由 blog_scheduler.sh 每三天 09:00 调用）
#
# 功能：抓取热点 → 生成「小绿看热点」时评 → 写入 articles.json → 推送
# 日志：data/daily_log/article_update.log
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BLOG_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="$BLOG_ROOT/data/daily_log/article_update.log"

mkdir -p "$(dirname "$LOG_FILE")"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ===== 文章定时更新开始 =====" >> "$LOG_FILE"

if command -v python3 >/dev/null 2>&1; then
    # 环境变量会自动传给 python（PROXY / GH_TOKEN / BLOG_LLM_KEY 等）
    python3 "$SCRIPT_DIR/generate_article.py" --push >> "$LOG_FILE" 2>&1
    EXIT_CODE=$?
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 文章更新结束，退出码=$EXIT_CODE" >> "$LOG_FILE"
    exit $EXIT_CODE
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️ 无 python3，跳过文章更新" >> "$LOG_FILE"
    exit 1
fi
