# 博客定时任务设计（blog_scheduler）

博客维护自动化共三个定时任务，由统一的调度器 `scripts/blog_scheduler.sh` 驱动。

## 任务总览

| 任务 | 时间 | 入口脚本 | 功能 |
|------|------|----------|------|
| 群聊记忆更新 | 每晚 23:00 | `scripts/run_group_memory.sh` | 拉取当天群聊总结 → 脱敏 → 写入 group_memory.json → 推送 |
| 文章时评更新 | 每三天 09:00 | `scripts/run_article_update.sh` | 抓取热点 → 生成「小绿看热点」时评 → 写入 articles.json → 推送 |
| 每日回忆总结 | 每天 00:00 | `scripts/run_daily_summary.sh`（原有） | 总结前一天事件 → memories.json → 推送 |

## 部署方法（用户工作区）

```bash
cd /workspace/default/xiaolu-blog/

# 1. 启动统一调度器（后台常驻，容器重启可手动恢复）
nohup bash scripts/blog_scheduler.sh >/dev/null 2>&1 &

# 2. 查看运行状态
pgrep -af blog_scheduler.sh

# 3. 查看调度日志
tail -f data/daily_log/blog_cron.log

# 4. 停止调度器
pkill -f blog_scheduler.sh
```

### 方式二：系统 cron（宿主机）

```cron
# 每晚 23:00 群聊记忆
0 23 * * * /bin/bash /workspace/default/xiaolu-blog/scripts/run_group_memory.sh >> /workspace/default/xiaolu-blog/data/daily_log/blog_cron.log 2>&1
# 每三天 09:00 文章更新（用 % 取模实现每三天）
0 9 */3 * * /bin/bash /workspace/default/xiaolu-blog/scripts/run_article_update.sh >> /workspace/default/xiaolu-blog/data/daily_log/blog_cron.log 2>&1
```

## 各任务说明

### 1. 群聊记忆更新（每晚 23:00）

流程：`fetch_group_summary.py`（从 OneBot 拉群总结图片）→ 图片解析为文本 → `update_group_memory.py --push`。

- 需要能访问 OneBot HTTP 服务的环境（NapCat/Lagrange 所在主机）
- 图片→文本的解析需配置 `PARSE_SCRIPT`（OCR/AI 脚本，输入图片路径、输出文本到 stdout）
- 若无解析能力，脚本会把当天图片清单记入 `data/daily_log/group_memory.log`，等待技能/人工补录

配置（环境变量）：
```bash
export ONEBOT_BASE="http://127.0.0.1:3000"
export ONEBOT_TOKEN="你的token"
export GROUP_ID="798378266"
export SUMMARY_SENDER="434672754"
export GROUP_SUMMARY_DIR="/workspace/default/shared/group_summary"
export PARSE_SCRIPT="/path/to/parse_summary.sh"   # 可选
```

### 2. 文章时评更新（每三天 09:00）

流程：`generate_article.py` 多源抓取热点 → 按时间/关键词筛选（正能量/科技/教育/民生）→ 生成时评 → 写入 `data/articles.json` → push。

新闻源：
- 央视新闻 JSONP（`news.cctv.com`，实时）
- 人民网教育 RSS
- 中新网滚动 RSS

时评生成：
- 默认使用内置模板（保证可读、风格统一）
- 配置 `BLOG_LLM_KEY` 后调用 LLM 生成高质量时评（OpenAI 兼容接口）

```bash
export BLOG_LLM_KEY="sk-xxx"                        # 可选
export BLOG_LLM_URL="https://ark.cn-beijing.volces.com/api/v3/chat/completions"  # 可选
export PROXY="http://192.168.0.92:18081"            # 可选，外网代理
export GH_TOKEN="ghp_xxx"                           # 推送用（或放 scripts/.gh_token）
```

手动测试：
```bash
python3 scripts/generate_article.py --dry-run   # 预览
python3 scripts/generate_article.py --push      # 生成并推送
```

筛选出的热点会同时保存到 `data/hot_topic_queue.json`，供人工/AI 参考选题。

### 3. 原有每日回忆总结（每天 00:00）

由 `cron_runner.sh`（原有）负责，不受本次改动影响。

## 容错说明

- 所有任务日志集中在 `data/daily_log/` 下（blog_cron.log / group_memory.log / article_update.log）
- 新闻源全部失败时 `generate_article.py` 会安全退出，不会写坏 articles.json
- 同一天重复执行群聊记忆/文章任务均有幂等保护（当日条目覆盖/跳过），不会产生重复
- 定时任务仅记录隐私脱敏后的内容，原始事件日志 `data/daily_log/*.jsonl` 已 gitignore，不会上传
