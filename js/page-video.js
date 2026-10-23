// 视频页：B站视频卡片 + 分页
(function () {
    'use strict';
    var esc = GD.escapeHtml;
    var PER_PAGE = 4;
    var allVideos = [];
    var currentPage = 1;

    function formatViews(num) {
        var n = Number(num);
        if (!isFinite(n)) return '';
        if (n >= 10000) return (n / 10000).toFixed(1) + '万';
        return String(n);
    }

    // bvid 直接拼进播放器地址，先卡格式：只允许字母数字
    function safeBvid(value) {
        var s = String(value || '');
        return /^[A-Za-z0-9]{4,20}$/.test(s) ? s : '';
    }

    document.addEventListener('DOMContentLoaded', async function () {
        var container = document.getElementById('videosContainer');
        try {
            allVideos = await GD.fetchJSON('data/videos.json');
            allVideos.sort(function (a, b) { return new Date(b.pubdate) - new Date(a.pubdate); });
            renderPage(1);
        } catch (e) {
            if (container) {
                container.innerHTML = '<p style="text-align: center; color: #999; padding: 2rem;">视频加载失败，请刷新重试～</p>';
            }
            console.error('加载视频失败:', e);
        }
    });

    function renderPage(page) {
        var container = document.getElementById('videosContainer');
        if (!container) return;
        var totalPages = Math.ceil(allVideos.length / PER_PAGE) || 1;
        currentPage = Math.max(1, Math.min(page, totalPages));

        var start = (currentPage - 1) * PER_PAGE;
        var pageVideos = allVideos.slice(start, start + PER_PAGE);

        container.innerHTML = pageVideos.map(function (video) {
            var bvid = safeBvid(video.bvid);
            var embed = bvid
                ? '<div class="video-embed"><iframe src="//player.bilibili.com/player.html?bvid=' + bvid +
                  '&page=1&high_quality=1&danmaku=0&autoplay=0" scrolling="no" frameborder="no" ' +
                  'allowfullscreen="true" sandbox="allow-same-origin allow-forms allow-scripts"></iframe></div>'
                : '<div class="video-embed"><p style="text-align:center;color:#999;padding:2rem;">视频地址无效</p></div>';
            var link = bvid
                ? '<a href="https://www.bilibili.com/video/' + bvid + '" target="_blank" rel="noopener noreferrer" ' +
                  'style="color: var(--green-main);">🡵 去B站观看</a>'
                : '';
            return '<div class="video-card">' + embed +
                '<div class="video-info">' +
                '<h3 class="video-title">' + esc(video.thumbnail || '') + ' ' + esc(video.title) + '</h3>' +
                '<div class="video-meta">' +
                '<span>👤 UP主：' + esc(video.up) + '</span>' +
                '<span>👀 播放：' + esc(formatViews(video.views)) + '</span>' +
                '<span>📅 发布：' + esc(video.pubdate) + '</span>' + link +
                '</div>' +
                (video.description ? '<div class="video-desc">' + GD.sanitizeRich(video.description) + '</div>' : '') +
                '</div></div>';
        }).join('');

        var totalCountEl = document.getElementById('totalCount');
        var totalPagesEl = document.getElementById('totalPages');
        if (totalCountEl) totalCountEl.textContent = allVideos.length;
        if (totalPagesEl) totalPagesEl.textContent = totalPages;

        GD.renderPagination(document.getElementById('pagination'), totalPages, currentPage, renderPage);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
})();
