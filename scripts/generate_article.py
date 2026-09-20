#!/usr/bin/env python3
"""
「小绿看热点」文章定时生成脚本

用途：
    每三天由 blog_scheduler.sh 触发，抓取新闻源热点，
    只筛选科技板块话题（航天/AI/机器人/科普等），生成「小绿看热点」时评文章，
    写入 data/articles.json 并（可选）自动推送到 GitHub Pages。

重要约定：
    ★ 只发科技板块，政治/时政/外交/军事/社会争议内容一律不碰 ★
    通过 GOOD_KEYWORDS（科技主题）+ SKIP_KEYWORDS（政治负面）双重过滤保证。

流程：
    1. 多源抓取热点（央视新闻 JSONP / 人民网科技 RSS / 中新网 RSS）
    2. 按时间（近 N 天）与科技关键词筛选
    3. 生成时评草稿（内置模板，保证可读；若配置 LLM 则调用生成高质量时评）
    4. 幂等写入 articles.json（新 id = 当前最大 id + 1）
    5. --push 时 git commit & push

环境变量：
    BLOG_LLM_KEY     （可选）LLM API Key，配置后调用 AI 生成高质量时评
    BLOG_LLM_URL     （可选）LLM API 地址（OpenAI 兼容 /v1/chat/completions）
    BLOG_LLM_MODEL   （可选）模型名，默认 doubao-seed-2.0-lite
    PROXY            （可选）http 代理，如 http://192.168.0.92:18081

用法：
    python3 generate_article.py            # 生成并写入（不推送）
    python3 generate_article.py --push     # 生成、写入并推送
    python3 generate_article.py --dry-run  # 预览，不写入
    python3 generate_article.py --force    # 今天已生成也强制重新生成
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone

CST = timezone(timedelta(hours=8))

BLOG_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARTICLES_PATH = os.path.join(BLOG_ROOT, "data", "articles.json")
QUEUE_PATH = os.path.join(BLOG_ROOT, "data", "hot_topic_queue.json")

# 文章作者署名与风格（与现有「小绿看热点」系列保持一致）
AUTHOR_LINE = '—— 小绿 写于 %s 🌱'

# 科技主题关键词（本博客时评只发科技板块，命中即优先入选）
GOOD_KEYWORDS = [
    "航天", "太空", "月球", "火星", "火箭", "卫星", "空间站", "宇航员",
    "科技", "科学家", "科研", "实验室", "创新", "专利",
    "AI", "人工智能", "机器人", "芯片", "半导体", "量子", "大模型",
    "软件", "互联网", "5G", "6G", "数字", "数据", "算力", "云计算",
    "新能源", "光伏", "电池", "电动车", "汽车", "高铁", "磁悬浮",
    "无人机", "自动驾驶", "生物", "基因", "医疗", "疫苗", "药物",
    "科普", "科学", "望远镜", "探测器", "深海", "极地",
]

# 排除话题：政治/时政/外交/军事/社会争议/负面，一律不碰
SKIP_KEYWORDS = [
    # 政治与领导人
    "习近平", "总理", "主席", "国务院", "全国人大", "政协", "书记",
    "党代会", "全会", "部委", "官员", "领导", "政府", "政策", "部级",
    "外交", "大使", "会谈", "会见", "磋商", "制裁", "关税", "贸易战",
    # 军事冲突
    "战争", "冲突", "袭击", "导弹", "军事", "军队", "演习", "国防",
    "北约", "美军", "俄军", "乌军", "以军", "哈马斯", "以色列", "巴勒斯坦",
    # 负面
    "事故", "火灾", "爆炸", "地震", "洪水", "台风", "遇难", "死亡",
    "受伤", "车祸", "灾难", "疫情", "确诊", "腐败", "贪腐", "处罚",
    "拘留", "抓捕", "判刑", "争议", "纠纷", "投诉", "维权", "诈骗",
    # 民生时政（非科技）
    "就业", "房价", "养老金", "社保", "医保", "反腐",
]

# ========== 新闻源抓取 ==========

def http_get(url, timeout=20):
    """GET 请求，返回文本。支持代理。"""
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (blog-generator)"})
    proxy = os.environ.get("PROXY")
    opener = urllib.request.build_opener(
        urllib.request.ProxyHandler({"http": proxy, "https": proxy}) if proxy else urllib.request.BaseHandler()
    )
    with opener.open(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", "replace")


def fetch_cctv():
    """央视新闻 JSONP：https://news.cctv.com/2019/07/gaiban/cmsdatainterface/page/news_1.jsonp"""
    items = []
    for page in (1, 2):
        url = f"https://news.cctv.com/2019/07/gaiban/cmsdatainterface/page/news_{page}.jsonp"
        try:
            text = http_get(url)
        except Exception:
            continue
        m = re.search(r'\(([\s\S]*)\)\s*$', text)
        if not m:
            continue
        try:
            data = json.loads(m.group(1))
        except Exception:
            continue
        for it in data.get("data", {}).get("list", []):
            items.append({
                "title": it.get("title", "").strip(),
                "brief": (it.get("brief") or "").strip(),
                "url": it.get("url", ""),
                "time": (it.get("focus_date") or it.get("date") or "").strip(),
                "source": "央视新闻",
            })
    return items


def fetch_people_edu():
    """人民网教育 RSS"""
    items = []
    url = "https://www.people.com.cn/rss/edu.xml"
    try:
        text = http_get(url)
    except Exception:
        return items
    for m in re.finditer(r"<item>([\s\S]*?)</item>", text):
        title = (re.search(r"<title><!\[CDATA\[([\s\S]*?)\]\]></title>", m.group(1)) or [None, ""])[1]
        link = (re.search(r"<link>([\s\S]*?)</link>", m.group(1)) or [None, ""])[1]
        pub = (re.search(r"<pubDate>([\s\S]*?)</pubDate>", m.group(1)) or [None, ""])[1]
        items.append({
            "title": title.strip(),
            "brief": "",
            "url": link.strip(),
            "time": pub.strip(),
            "source": "人民网教育",
        })
    return items


def fetch_chinanews():
    """中新网滚动 RSS"""
    items = []
    url = "https://www.chinanews.com.cn/rss/scroll-news.xml"
    try:
        text = http_get(url)
    except Exception:
        return items
    for m in re.finditer(r"<item>([\s\S]*?)</item>", text):
        title = (re.search(r"<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?</title>", m.group(1)) or [None, ""])[1]
        link = (re.search(r"<link>([\s\S]*?)</link>", m.group(1)) or [None, ""])[1]
        items.append({
            "title": title.strip(),
            "brief": "",
            "url": link.strip(),
            "time": "",
            "source": "中新网",
        })
    return items


def fetch_all():
    """抓取所有源，合并去重"""
    seen, merged = set(), []
    for fn in (fetch_cctv, fetch_people_edu, fetch_chinanews):
        try:
            for it in fn():
                key = it["title"][:30]
                if key and key not in seen:
                    seen.add(key)
                    merged.append(it)
        except Exception:
            continue
    return merged


# ========== 筛选 ==========

def pick_topics(items, days=3, limit=3):
    """按时间/关键词筛选热点，返回 (热门列表, 备选队列)"""
    now = datetime.now(CST)
    hot, queue = [], []
    for it in items:
        title = it["title"]
        text = title + " " + it["brief"]
        if any(k in text for k in SKIP_KEYWORDS):
            continue
        # 时间过滤（能解析则用，解析不了不拦）
        if it["time"]:
            try:
                t = datetime.fromisoformat(it["time"].replace("Z", "+08:00"))
                if t.tzinfo is None:
                    t = t.replace(tzinfo=CST)
                if (now - t) > timedelta(days=days):
                    continue
            except Exception:
                pass
        score = sum(1 for k in GOOD_KEYWORDS if k in text)
        entry = {**it, "score": score}
        if score > 0:
            hot.append(entry)
        else:
            queue.append(entry)
    hot.sort(key=lambda x: (-x["score"], x["time"]), reverse=False)
    hot.sort(key=lambda x: -x["score"])
    return hot[:limit], queue


# ========== 时评生成 ==========

def build_article(topics):
    """生成时评文章（模板骨架，无 LLM 时使用）"""
    now = datetime.now(CST)
    today = now.strftime("%Y-%m-%d")
    title = "小绿看热点｜" + "、".join(t["title"][:18] for t in topics[:2]) + "……"
    if len(title) > 45:
        title = title[:45] + "……"

    paras = [
        "<p>大家好呀，我是小绿🌱 本大小姐又来给大家聊热点啦，这期挑了"
        + str(len(topics)) + "条适合同学们的好消息，快来一起看看吧！</p>"
    ]
    for i, t in enumerate(topics, 1):
        brief = (t["brief"] or "").strip() or "相关报道详见原链接。"
        # 去掉末尾句号再拼，避免双句号
        brief = brief.rstrip("。")
        paras.append(
            f"<p><strong>第{i}条：{t['title']}</strong>"
            f"{brief}。"
            f"（来源：{t['source']}）</p>"
        )
    paras.append(
        "<p>好啦，本期小评就到这里～记得绿色上网、多关注正能量内容，"
        "保持好奇心，好好学习天天向上，我们下次见😘</p>"
    )
    paras.append(f'<p style="text-align:right;color:#81C784;">{AUTHOR_LINE % today}</p>')

    return {
        "thumbnail": "📰",
        "date": today,
        "title": title,
        "excerpt": "".join(paras),
        "tags": ["热点评价", "社会观察", "绿坝娘小课堂", "正能量", "自动生成"],
        "auto_generated": True,
    }


def call_llm(topics):
    """可选：调用 LLM 生成高质量时评。未配置返回 None。"""
    key = os.environ.get("BLOG_LLM_KEY")
    if not key:
        return None
    url = os.environ.get("BLOG_LLM_URL", "https://ark.cn-beijing.volces.com/api/v3/chat/completions")
    model = os.environ.get("BLOG_LLM_MODEL", "doubao-seed-2.0-lite")
    prompt = (
        "你是绿坝娘小绿，为个人博客写一篇「小绿看热点」时评文章，风格活泼可爱、积极正能量，面向学生和年轻人。\n"
        "要求：以HTML段落输出（<p>标签），开头问候、逐条点评热点、结尾绿色上网提醒，最后加署名。\n"
        "热点素材如下（JSON）：\n" + json.dumps(topics, ensure_ascii=False, indent=2)
    )
    body = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 2000,
    }).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", "Bearer " + key)
    try:
        proxy = os.environ.get("PROXY")
        opener = urllib.request.build_opener(
            urllib.request.ProxyHandler({"http": proxy, "https": proxy}) if proxy else urllib.request.BaseHandler()
        )
        with opener.open(req, timeout=60) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
        content = payload["choices"][0]["message"]["content"]
        now = datetime.now(CST)
        return {
            "thumbnail": "📰",
            "date": now.strftime("%Y-%m-%d"),
            "title": "小绿看热点｜" + "、".join(t["title"][:15] for t in topics[:2]),
            "excerpt": content,
            "tags": ["热点评价", "社会观察", "绿坝娘小课堂", "正能量"],
            "auto_generated": True,
        }
    except Exception as e:
        print("⚠️ LLM 调用失败，回退模板生成:", e, file=sys.stderr)
        return None


# ========== 写入与推送 ==========

def write_article(article, push=False, dry_run=False):
    with open(ARTICLES_PATH, "r", encoding="utf-8") as f:
        articles = json.load(f)
    # 幂等：同一天已有自动生成文章则跳过（除非 --force）
    if not args.force and any(
        a.get("date") == article["date"] and a.get("auto_generated")
        for a in articles
    ):
        print("ℹ️ 今天已生成过自动文章，跳过（--force 可强制）")
        return False
    new_id = max((a.get("id", 0) for a in articles), default=0) + 1
    article["id"] = new_id
    articles.append(article)
    if dry_run:
        print("🔍 预览文章（未写入）：")
        print("  id:", new_id, "| 标题:", article["title"])
        return True
    with open(ARTICLES_PATH, "w", encoding="utf-8") as f:
        json.dump(articles, f, ensure_ascii=False, indent=4)
    print("✅ 已写入 articles.json，id =", new_id)
    if push:
        git_push(new_id)
    return True


def git_push(article_id):
    proxy = os.environ.get("PROXY", "http://192.168.0.92:18081")
    token = os.environ.get("GH_TOKEN", "")
    token_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".gh_token")
    if not token and os.path.exists(token_file):
        token = open(token_file).read().strip()
    import subprocess
    env = dict(os.environ)
    if proxy:
        env["http_proxy"] = env["https_proxy"] = env["HTTP_PROXY"] = env["HTTPS_PROXY"] = proxy
    try:
        subprocess.run(["git", "add", "data/articles.json", "data/hot_topic_queue.json"],
                       cwd=BLOG_ROOT, check=True, env=env, capture_output=True)
        subprocess.run(["git", "commit", "-m", f"feat: 小绿看热点文章自动更新（id={article_id}）"],
                       cwd=BLOG_ROOT, check=True, env=env, capture_output=True)
        subprocess.run(["git", "push", "origin", "main"], cwd=BLOG_ROOT, check=True, env=env, capture_output=True)
        print("🚀 已推送到 GitHub")
    except subprocess.CalledProcessError as e:
        print("⚠️ 推送失败:", e.stderr.decode("utf-8", "replace")[-300:], file=sys.stderr)


def main():
    global args
    p = argparse.ArgumentParser(description="小绿看热点文章自动生成")
    p.add_argument("--push", action="store_true", help="写入后自动推送")
    p.add_argument("--dry-run", action="store_true", help="只预览不写入")
    p.add_argument("--force", action="store_true", help="当天已有也强制重新生成")
    p.add_argument("--days", type=int, default=3, help="热点时间范围（天）")
    args = p.parse_args()

    print("🔍 抓取新闻热点...")
    items = fetch_all()
    if not items:
        print("❌ 所有新闻源都抓取失败，本次跳过", file=sys.stderr)
        sys.exit(1)
    print(f"📡 共抓取 {len(items)} 条候选")

    topics, queue = pick_topics(items, days=args.days, limit=3)
    print(f"🎯 选中 {len(topics)} 条热点：")
    for t in topics:
        print("  -", t["title"])

    # 保存热点队列（供人工/AI 参考）
    os.makedirs(os.path.dirname(QUEUE_PATH), exist_ok=True)
    with open(QUEUE_PATH, "w", encoding="utf-8") as f:
        json.dump({"generated_at": datetime.now(CST).isoformat(), "topics": topics, "queue": queue[:10]},
                  f, ensure_ascii=False, indent=2)

    if not topics:
        print("ℹ️ 没有命中合适热点，仅保存队列，本次不生成文章")
        return

    # 优先 LLM，回退模板
    article = call_llm(topics) or build_article(topics)
    write_article(article, push=args.push, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
