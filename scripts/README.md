# 脚本说明

## 公共库

`common.py` 是这个目录里唯一该改的地方之一：脱敏规则、原子写 JSON、UTC+8 时区、
代理与 token 读取、git 提交推送、HTML 白名单净化都在这里。其余脚本 import 它，不再各写一份。

## 常用命令

```bash
# 记录一条事件（默认 work，第二参可传 chat）
bash scripts/update_memory.sh log "完成了博客重构" work

# 生成指定日期的回忆并推送
bash scripts/update_memory.sh summary 2026-10-23

# 环境自检
bash scripts/update_memory.sh check

# 手动加一条回忆（写 data/memories.json）
python3 scripts/update_memories.py --title "标题" "正文"

# 群聊记忆
python3 scripts/update_group_memory.py --file summary.txt --push

# 热点时评
python3 scripts/generate_article.py --dry-run
```

## 脱敏

所有写进 `data/` 的文本都会过 `common.redact()`：身份证、银行卡、手机号、QQ 号、群号、
邮箱、token、链接、@提及一律换成占位符。规则在 `common.PRIVACY_RULES`，顺序是先长后短。

## 定时任务

有 cron 的机器用 `setup_cron.sh`；容器里没有 cron，就用 `blog_scheduler.sh` 和
`cron_runner.sh` 常驻。这两个共用 `${TMPDIR:-/tmp}/xiaolu-scheduler.lock`，
同时只会有一个在跑。详见 `docs/scheduler.md`。

## 注意

- 推送凭据：`GH_TOKEN` 环境变量或 `scripts/.gh_token`（已 gitignore）。
  不会写进 git remote，也不会出现在命令行参数里。
- 代理：`PROXY` 环境变量，不设就直连。
- 群号 / 发送者 QQ：`GROUP_ID` / `SUMMARY_SENDER`，仓库里不放真实号码。
