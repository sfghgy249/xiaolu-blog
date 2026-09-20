#!/bin/bash
# ============================================================
# 博客定时调度器（容器内自调度，无 cron 环境的替代方案）
#
# 任务清单：
#   1. 每晚 23:00  更新群聊记忆（fetch_group_summary → update_group_memory --push）
#   2. 每三天 09:00 更新文章（抓取热点 → 生成时评 → 写入 articles.json → push）
#
# 启动方式（后台运行）：
#   nohup /workspace/default/xiaolu-blog/scripts/blog_scheduler.sh &
#
# 停止方式：
#   pkill -f blog_scheduler.sh
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BLOG_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="$BLOG_ROOT/data/daily_log/blog_cron.log"

mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# 每三天触发一次的文章更新日（从脚本启动日开始，每隔 3 天）
# 用「距纪元的天数 % 3」判断，保证重启后仍按同一节奏
ARTICLES_INTERVAL_DAYS=3

log "blog_scheduler 启动，PID=$$，博客根目录=$BLOG_ROOT"

# 处理完某任务后，记住本次日期，避免同一天重复执行
LAST_GROUP_MEMORY_DATE=""
LAST_ARTICLE_DATE=""

while true; do
    NOW_TS=$(date +%s)
    HOUR=$(date +%H)

    # ---------- 任务1：每晚 23:00 更新群聊记忆 ----------
    if [ "$HOUR" = "23" ] && [ "$LAST_GROUP_MEMORY_DATE" != "$(date +%F)" ]; then
        # 避免在 23:00 这个小时内反复触发（整小时才跑一次）
        MIN=$(date +%M)
        if [ "$MIN" -le 5 ]; then
            log "⏰ 开始每晚群聊记忆更新"
            if [ -f "$SCRIPT_DIR/run_group_memory.sh" ]; then
                /bin/bash "$SCRIPT_DIR/run_group_memory.sh" >> "$LOG_FILE" 2>&1
                log "✅ 群聊记忆更新执行完毕"
            else
                log "⚠️ 未找到 run_group_memory.sh，跳过"
            fi
            LAST_GROUP_MEMORY_DATE="$(date +%F)"
        fi
    fi

    # ---------- 任务2：每三天 09:00 更新文章时评 ----------
    if [ "$HOUR" = "09" ] && [ "$LAST_ARTICLE_DATE" != "$(date +%F)" ]; then
        MIN=$(date +%M)
        # 每三天的节奏判断：纪元天数对 3 取模
        DAYS_SINCE_EPOCH=$(( $(date +%s) / 86400 ))
        if [ $(( DAYS_SINCE_EPOCH % ARTICLES_INTERVAL_DAYS )) -eq 0 ] && [ "$MIN" -le 5 ]; then
            log "⏰ 开始每三天文章更新（热点时评）"
            if [ -f "$SCRIPT_DIR/run_article_update.sh" ]; then
                /bin/bash "$SCRIPT_DIR/run_article_update.sh" >> "$LOG_FILE" 2>&1
                log "✅ 文章更新执行完毕"
            else
                log "⚠️ 未找到 run_article_update.sh，跳过"
            fi
            LAST_ARTICLE_DATE="$(date +%F)"
        fi
    fi

    # 每 60 秒检查一次（精确到整点分钟）
    sleep 60
done
