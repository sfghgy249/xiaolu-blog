// 记忆页：小绿回忆 + 群聊记忆，分类 + 分页
(function () {
    'use strict';
    var esc = GD.escapeHtml;
    var PER_PAGE = 5;
    var allMemories = [];
    var filteredMemories = [];
    var currentPage = 1;
    var currentTab = 'all';

    document.addEventListener('DOMContentLoaded', async function () {
        // 两个数据源互不影响
        var results = await Promise.allSettled([
            GD.fetchJSON('data/memories.json'),
            GD.fetchJSON('data/group_memory.json')
        ]);
        var memories = results[0].status === 'fulfilled' ? results[0].value : [];
        var groupMemories = results[1].status === 'fulfilled' ? results[1].value : [];
        if (results[0].status === 'rejected') console.error('加载小绿回忆失败:', results[0].reason);
        if (results[1].status === 'rejected') console.error('加载群聊记忆失败:', results[1].reason);

        memories.forEach(function (m) { m._type = 'memory'; });
        groupMemories.forEach(function (m) { m._type = 'group'; });
        allMemories = memories.concat(groupMemories);
        allMemories.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });

        setText('memoryCount', allMemories.length);
        setText('memoryTypeCount', memories.length);
        setText('groupTypeCount', groupMemories.length);
        if (allMemories.length > 0) setText('latestDate', allMemories[0].date);

        var container = document.getElementById('memoriesContainer');
        if (!allMemories.length) {
            if (container) container.innerHTML = '<p style="text-align: center; color: #999; padding: 2rem;">记忆加载失败或暂无内容，请刷新重试～</p>';
            return;
        }

        var tabBar = document.getElementById('tabBar');
        if (tabBar) {
            tabBar.querySelectorAll('.tab-btn').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    tabBar.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
                    btn.classList.add('active');
                    currentTab = btn.dataset.tab;
                    applyFilter();
                });
            });
        }
        applyFilter();
    });

    function setText(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    function applyFilter() {
        filteredMemories = currentTab === 'all'
            ? allMemories
            : allMemories.filter(function (m) { return m._type === currentTab; });

        var container = document.getElementById('memoriesContainer');
        var pager = document.getElementById('pagination');
        if (!filteredMemories.length) {
            if (container) container.innerHTML = '<p style="text-align: center; color: #999; padding: 2rem;">这个分类下还没有内容哦～</p>';
            if (pager) pager.innerHTML = '';
            return;
        }
        renderPage(1);
    }

    function formatDate(value) {
        var d = new Date(value);
        if (isNaN(d.getTime())) return String(value);
        var p = function (n) { return n < 10 ? '0' + n : String(n); };
        return d.getFullYear() + '年' + p(d.getMonth() + 1) + '月' + p(d.getDate()) + '日';
    }

    function renderPage(page) {
        var container = document.getElementById('memoriesContainer');
        if (!container) return;
        var totalPages = Math.ceil(filteredMemories.length / PER_PAGE) || 1;
        currentPage = Math.max(1, Math.min(page, totalPages));

        var start = (currentPage - 1) * PER_PAGE;
        var pageMemories = filteredMemories.slice(start, start + PER_PAGE);

        container.innerHTML = pageMemories.map(function (memory) {
            var isGroup = memory._type === 'group';
            var badge = isGroup
                ? '<span class="type-badge group">💬 群聊记忆</span>'
                : '<span class="type-badge memory">🌱 小绿回忆</span>';
            var topics = memory.topics || [];
            var topicsHtml = topics.length
                ? '<div class="topic-list">' + topics.map(function (t) {
                    return '<span class="topic-chip">' + esc(t) + '</span>';
                }).join('') + '</div>'
                : '';
            // 正文允许行内强调，但只走白名单
            var paragraphs = (memory.content || []).map(function (p) {
                return '<p>' + GD.sanitizeRich(p) + '</p>';
            }).join('\n                    ');
            var tagsHtml = (memory.tags || []).map(function (t) {
                return '<span class="memory-tag">#' + esc(t) + '</span>';
            }).join('');
            return '<div class="memory-card ' + (isGroup ? 'group-type' : '') + '">' +
                '<span class="memory-date">📅 ' + esc(formatDate(memory.date)) + '</span>' + badge +
                '<h3 class="memory-title">' + esc(memory.title) + '</h3>' +
                topicsHtml +
                '<div class="memory-content">' + paragraphs + '</div>' +
                '<div class="memory-tags">' + tagsHtml + '</div>' +
                '</div>';
        }).join('\n');

        GD.renderPagination(document.getElementById('pagination'), totalPages, currentPage, renderPage);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
})();
