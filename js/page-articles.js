// 文章列表：分类 + 分页
(function () {
    'use strict';
    var esc = GD.escapeHtml;
    var ITEMS_PER_PAGE = 6;
    var allArticles = [];
    var currentPage = 1;
    var currentTag = null;

    document.addEventListener('DOMContentLoaded', async function () {
        var container = document.getElementById('articlesContainer');
        try {
            allArticles = await GD.fetchJSON('data/articles.json');
            allArticles.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
            renderTagCloud();
            renderPage(1);
        } catch (e) {
            if (container) {
                container.innerHTML = '<p style="text-align: center; color: #999; padding: 2rem;">文章加载失败，请刷新重试～</p>';
            }
            console.error('加载文章失败:', e);
        }
    });

    function renderTagCloud() {
        var tagCount = {};
        allArticles.forEach(function (a) {
            (a.tags || []).forEach(function (t) { tagCount[t] = (tagCount[t] || 0) + 1; });
        });

        var tagCloud = document.getElementById('tagCloud');
        if (!tagCloud) return;
        tagCloud.innerHTML = '<a href="#" class="tag-item" data-tag="">全部</a>' +
            Object.keys(tagCount).map(function (tag) {
                return '<a href="#" class="tag-item" data-tag="' + esc(tag) + '">' +
                    esc(tag) + ' (' + tagCount[tag] + ')</a>';
            }).join('');

        tagCloud.querySelectorAll('.tag-item').forEach(function (el) {
            el.addEventListener('click', function (e) {
                e.preventDefault();
                currentTag = el.dataset.tag || null;
                currentPage = 1;
                renderPage(1);
                tagCloud.querySelectorAll('.tag-item').forEach(function (t) { t.classList.remove('active'); });
                el.classList.add('active');
            });
        });
        var initial = tagCloud.querySelector('.tag-item[data-tag=""]');
        if (initial) initial.classList.add('active');
    }

    function getFilteredArticles() {
        if (!currentTag) return allArticles;
        return allArticles.filter(function (a) { return (a.tags || []).indexOf(currentTag) !== -1; });
    }

    function renderPage(page) {
        var container = document.getElementById('articlesContainer');
        if (!container) return;
        var filtered = getFilteredArticles();
        var totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
        currentPage = Math.max(1, Math.min(page, totalPages));

        var start = (currentPage - 1) * ITEMS_PER_PAGE;
        var pageArticles = filtered.slice(start, start + ITEMS_PER_PAGE);

        container.innerHTML = pageArticles.map(function (article) {
            return '<article class="post-card">' +
                '<div class="post-thumbnail">' + esc(article.thumbnail) + '</div>' +
                '<div class="post-content">' +
                '<span class="post-date">' + esc(article.date) + '</span>' +
                '<h2 class="post-title">' + esc(article.title) + '</h2>' +
                // 摘要来自抓取与模型输出，走白名单净化，不允许带属性与脚本
                // 摘要本身是段落集合，外层必须是 div，套 p 会被浏览器提前闭合
                '<div class="post-excerpt">' + GD.sanitizeRich(article.excerpt) + '</div>' +
                '<div class="post-tags">' +
                (article.tags || []).map(function (t) {
                    return '<span class="tag">#' + esc(t) + '</span>';
                }).join('') +
                '</div></div></article>';
        }).join('');

        var totalCountEl = document.getElementById('totalCount');
        var totalPagesEl = document.getElementById('totalPages');
        if (totalCountEl) totalCountEl.textContent = allArticles.length;
        if (totalPagesEl) totalPagesEl.textContent = totalPages;

        GD.renderPagination(document.getElementById('pagination'), totalPages, currentPage, renderPage);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
})();
