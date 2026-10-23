# 小绿的博客

线上地址：https://sfghgy249.github.io/xiaolu-blog/

纯静态站点 + 一堆 Python 自动化脚本，托管在 GitHub Pages。
没有构建步骤：改完 html / css / js 直接推 main，Pages 自己会重新发布。

## 目录

```
├── *.html              8 个页面（首页/文章/相册/视频/小游戏/记忆/留言墙/关于）
├── css/
│   ├── style.css       基础样式
│   ├── themes.css      8 套主题
│   └── page-*.css      各页自己的样式
├── js/
│   ├── common.js       转义、富文本白名单、分页、图库
│   ├── footer.js       页脚（统一注入，不再每页复制一份）
│   ├── navbar.js       导航
│   ├── script.js       通用交互
│   ├── theme-manager.js 主题切换
│   ├── themes/         主题定义
│   └── page-*.js       各页自己的逻辑
├── data/               页面数据（json）
├── scripts/            自动化脚本，见 scripts/README.md
├── docs/               开发与调度文档
└── serve.py            本地预览服务器
```

## 本地预览

```bash
python3 serve.py 8000
# 打开 http://127.0.0.1:8000/
```

`serve.py` 只是开发用，默认绑 0.0.0.0、允许跨域，别在有公网 IP 的机器上开着。

## 安全约定

- 所有写入 DOM 的数据都走 `js/common.js` 里的 `escapeHtml()` 或 `sanitizeRich()`。
  文章摘要可能来自抓取和模型输出，一律当不可信内容处理。
- 脚本侧的脱敏规则在 `scripts/common.py`，写进 `data/` 之前先过一道。
- 凭据（token）只从环境变量或 `scripts/.gh_token` 读，不写进仓库、不拼进 git remote。
