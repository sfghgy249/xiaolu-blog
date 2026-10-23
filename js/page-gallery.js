// 相册：随机展示 greendam.icu 图库
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', async function () {
        var IMAGE_FOLDER = 'https://greendam.icu/images/';
        var galleryGrid = document.getElementById('galleryGrid');
        var refreshBtn = document.getElementById('refreshGalleryBtn');
        var allImages = [];

        function parseFileName(filename) {
            var name = String(filename).replace(/\.[^.]+$/, '');
            var parts = name.split('-');
            var author = parts.length > 0 ? parts[0] : '';
            var second = parts[1];
            var dateStr = second && /^\d{4,8}$/.test(second) ? second : '';
            var dateFormatted = '';
            if (dateStr) {
                var d = dateStr.replace(/[^\d]/g, '');
                if (d.length >= 4) dateFormatted = d.slice(0, 4) + '年';
            }
            return { author: author, date: dateFormatted };
        }

        function renderGallery(count) {
            if (!galleryGrid) return;
            var limit = count || 12;
            galleryGrid.textContent = '';
            var shuffled = allImages.slice().sort(function () { return 0.5 - Math.random(); });
            var selected = shuffled.slice(0, limit);

            selected.forEach(function (img) {
                var meta = parseFileName(img);
                var item = document.createElement('div');
                item.className = 'gallery-item';

                // 用 DOM 建节点，文件名不当 HTML 用
                var el = document.createElement('img');
                el.src = IMAGE_FOLDER + encodeURIComponent(img);
                el.alt = img;
                el.loading = 'lazy';

                var info = document.createElement('div');
                info.className = 'gallery-info';
                info.textContent = meta.author + (meta.date ? ' · ' + meta.date : '');

                item.appendChild(el);
                item.appendChild(info);
                galleryGrid.appendChild(item);
            });
        }

        try {
            allImages = await GD.loadGreendamImages();
            renderGallery();
        } catch (e) {
            if (galleryGrid) {
                galleryGrid.innerHTML = '<div style="text-align: center; grid-column: 1/-1; padding: 2rem; color: #ff6b9d;">图片加载失败，请检查网络连接</div>';
            }
        }

        if (refreshBtn) refreshBtn.addEventListener('click', function () { renderGallery(); });
    });
})();
