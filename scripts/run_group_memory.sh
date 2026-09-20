#!/bin/bash
# ============================================================
# 群聊记忆每日更新入口（由 blog_scheduler.sh 每晚 23:00 调用）
#
# 流程：
#   1. 从 OneBot 拉取当天群聊总结图片（fetch_group_summary.py）
#   2. 若拿到总结图片且有解析脚本，则解析为文本
#   3. 调用 update_group_memory.py 写入 group_memory.json 并 push
#
# 配置（环境变量）：
#   ONEBOT_BASE       OneBot HTTP 地址（默认 http://127.0.0.1:3000）
#   ONEBOT_TOKEN      OneBot 访问令牌
#   GROUP_ID          目标群号
#   SUMMARY_SENDER    群总结发送者 QQ
#   GROUP_SUMMARY_DIR 总结图片保存目录
#   SUMMARY_TEXT_DIR  解析后的总结文本目录（可选）
#   PARSE_SCRIPT      总结图片→文本 的解析脚本路径（可选）
#
# 说明：
#   - 群总结图片的「图片→文字」解析需要 OCR/AI 能力，
#     可在 PARSE_SCRIPT 配置一个脚本（输入图片路径，输出文本到 stdout）
#   - 若没有解析能力，脚本会把图片清单记录到日志，等待人工/技能补录
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BLOG_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="$BLOG_ROOT/data/daily_log/group_memory.log"
TODAY="$(date +%F)"

mkdir -p "$(dirname "$LOG_FILE")"
mkdir -p "${GROUP_SUMMARY_DIR:-/workspace/default/shared/group_summary}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"; }

log "===== 群聊记忆更新开始（$TODAY）====="

# ---------- 1. 拉取当天群总结图片 ----------
SUMMARY_DIR="${GROUP_SUMMARY_DIR:-/workspace/default/shared/group_summary}"
log "拉取群总结图片 → $SUMMARY_DIR"
if command -v python3 >/dev/null 2>&1; then
    python3 "$SCRIPT_DIR/fetch_group_summary.py" \
        --base "${ONEBOT_BASE:-http://127.0.0.1:3000}" \
        --token "${ONEBOT_TOKEN:-}" \
        --group "${GROUP_ID:-798378266}" \
        --sender "${SUMMARY_SENDER:-434672754}" \
        --output "$SUMMARY_DIR" --days 1 2>&1 | tee -a "$LOG_FILE"
else
    log "⚠️ 无 python3，跳过拉取"
fi

# ---------- 2. 查找今天的总结图片 ----------
SUMMARY_IMGS=()
for f in "$SUMMARY_DIR/$TODAY"*.jpg "$SUMMARY_DIR/$TODAY"*.png; do
    [ -f "$f" ] && SUMMARY_IMGS+=("$f")
done

if [ ${#SUMMARY_IMGS[@]} -eq 0 ]; then
    log "今天没有找到群总结图片，结束（可能还没生成）"
    exit 0
fi
log "找到 ${#SUMMARY_IMGS[@]} 张总结图片"

# ---------- 3. 解析图片为文本并写入 ----------
TEXT_DIR="${SUMMARY_TEXT_DIR:-$SUMMARY_DIR/parsed}"
mkdir -p "$TEXT_DIR"
TEXT_FILE="$TEXT_DIR/$TODAY.txt"

if [ -n "$PARSE_SCRIPT" ] && [ -x "$PARSE_SCRIPT" ]; then
    log "使用解析脚本: $PARSE_SCRIPT"
    : > "$TEXT_FILE"
    for img in "${SUMMARY_IMGS[@]}"; do
        "$PARSE_SCRIPT" "$img" >> "$TEXT_FILE" 2>> "$LOG_FILE" || \
            log "⚠️ 解析失败: $img"
    done
elif command -v python3 >/dev/null 2>&1 && [ -f "$SCRIPT_DIR/parse_summary_image.py" ]; then
    log "使用内置解析脚本 parse_summary_image.py"
    python3 "$SCRIPT_DIR/parse_summary_image.py" --output "$TEXT_FILE" "${SUMMARY_IMGS[@]}" >> "$LOG_FILE" 2>&1 || \
        log "⚠️ 内置解析失败，转人工补录"
fi

if [ -s "$TEXT_FILE" ]; then
    log "解析完成（$(wc -c < "$TEXT_FILE") 字节），写入群聊记忆并推送"
    python3 "$SCRIPT_DIR/update_group_memory.py" --file "$TEXT_FILE" --push >> "$LOG_FILE" 2>&1
    log "✅ 群聊记忆已更新并推送"
else
    log "⚠️ 总结文本为空，未写入（请在 group-memory-update 技能中补录当天总结）"
fi

log "===== 群聊记忆更新结束（$TODAY）====="
