// 首页动态时间线：文章 + 回忆 + 群聊记忆 按日期倒序合并展示
(function () {
    'use strict';
    var esc = GD.escapeHtml;

    document.addEventListener('DOMContentLoaded', async function () {
        var timelineEl = document.getElementById('timeline');
        var sidebarList = document.getElementById('latestPosts');
        try {
            var data = await Promise.all([
                GD.fetchJSON('data/articles.json'),
                GD.fetchJSON('data/memories.json'),
                GD.fetchJSON('data/group_memory.json')
            ]);
            var articles = data[0] || [], memories = data[1] || [], groupMemories = data[2] || [];

            // 统一为时间线条目
            var items = [];
            articles.forEach(function (a) {
                items.push({
                    date: a.date,
                    type: 'article',
                    badge: '📝 文章',
                    title: a.title,
                    summary: GD.plainText(a.excerpt).slice(0, 120),
                    tags: a.tags || [],
                    link: 'articles.html'
                });
            });
            memories.forEach(function (m) {
                items.push({
                    date: m.date,
                    type: 'memory',
                    badge: '🌱 回忆',
                    title: m.title,
                    summary: String((m.content || [])[0] || '').slice(0, 120),
                    tags: m.tags || [],
                    link: 'memories.html'
                });
            });
            groupMemories.forEach(function (g) {
                items.push({
                    date: g.date,
                    type: 'group',
                    badge: '💬 群聊记忆',
                    title: g.title,
                    summary: String((g.topics || []).join(' · ') || (g.content || [])[0] || '').slice(0, 120),
                    tags: g.tags || [],
                    link: 'memories.html'
                });
            });

            // 按日期倒序（新→旧）
            items.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
            var latest = items.slice(0, 10);

            if (timelineEl) {
                timelineEl.innerHTML = latest.map(function (item) {
                    return '<article class="post-card">' +
                        '<div class="post-content">' +
                        '<span class="post-date">' + esc(item.date) + ' · ' +
                        '<span class="timeline-badge">' + esc(item.badge) + '</span></span>' +
                        '<h2 class="post-title"><a href="' + esc(item.link) + '" style="color: inherit; text-decoration: none;">' +
                        esc(item.title) + '</a></h2>' +
                        '<p class="post-excerpt">' + esc(item.summary) + '</p>' +
                        '<div class="post-tags">' +
                        item.tags.slice(0, 4).map(function (t) {
                            return '<span class="tag">#' + esc(t) + '</span>';
                        }).join('') +
                        '</div></div></article>';
                }).join('');
            }

            // 侧边栏最新文章
            if (sidebarList) {
                var latestArticles = articles.slice()
                    .sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); })
                    .slice(0, 5);
                sidebarList.innerHTML = latestArticles.map(function (a) {
                    return '<li><a href="articles.html">' + esc(a.title) + '</a>' +
                        '<span class="latest-date">' + esc(a.date) + '</span></li>';
                }).join('');
            }
        } catch (e) {
            if (timelineEl) {
                timelineEl.innerHTML = '<p style="text-align:center;color:#999;padding:2rem;">内容加载失败，请刷新重试～</p>';
            }
            if (sidebarList) {
                sidebarList.innerHTML = '<li><a href="articles.html">查看文章列表 →</a></li>';
            }
            console.error('首页时间线加载失败:', e);
        }
    });

    // 绿坝放置：全屏遮罩层嵌入游戏，点击入口打开 / ✕返回 或 Esc 关闭
    (function () {
        var overlay = document.getElementById('clickerOverlay');
        if (!overlay) return;
        var openBtn = document.getElementById('openClickerBtn');
        var closeBtn = document.getElementById('closeClickerBtn');
        var frame = overlay.querySelector('.clicker-frame');
        if (openBtn) {
            openBtn.addEventListener('click', function () {
                if (frame && !frame.src) frame.src = frame.dataset.src; // 首次打开才加载游戏
                overlay.hidden = false;
                document.body.style.overflow = 'hidden';
            });
        }
        function closeOverlay() {
            overlay.hidden = true;
            document.body.style.overflow = '';
        }
        if (closeBtn) closeBtn.addEventListener('click', closeOverlay);
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && !overlay.hidden) closeOverlay();
        });
    })();
})();
