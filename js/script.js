// 小绿博客脚本 - 通用交互（平滑滚动、随机小绿图片）
// 飘落 emoji 与主题切换在 js/theme-manager.js，各主题定义在 js/themes/<主题名>.js
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {
        // 带锚点的链接平滑滚动（页面内跳转使用）
        document.querySelectorAll('a[href^="#"]:not([href="#"])').forEach(function (anchor) {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                var href = this.getAttribute('href');
                var target = document.querySelector(href);
                if (target) target.scrollIntoView({ behavior: 'smooth' });
            });
        });

        console.log('%c🌱 小绿的博客加载完成啦！', 'color: #228B22; font-size: 16px; font-weight: bold;');
        console.log('%c绿色上网，花季护航 💚', 'color: #32CD32; font-size: 14px;');

        // ========== 随机小绿图片（图库来自 greendam.icu）==========
        var IMAGE_FOLDER = 'https://greendam.icu/images/';
        var xiaoluImages = [
            // 兜底用本地图
            'img/gallery/xiaolu_avatar.jpg',
            'img/gallery/lvba_1.jpg',
            'img/gallery/lvba_2.jpg'
        ];
        var currentImageIndex = 0;
        var randomImageEl = document.getElementById('randomXiaoluImage');
        var refreshBtn = document.getElementById('refreshImageBtn');
        var imageInfoEl = document.getElementById('imageInfo');

        // 解析文件名：作者-日期-标题.jpg（greendam.icu 的命名规范）
        function parseFileName(filename) {
            var name = String(filename).replace(/\.[^.]+$/, '');
            var parts = name.split('-');
            var author = '';
            var dateStr = '';
            var title = '';

            if (parts.length > 0) author = parts[0];
            var second = parts[1];
            if (second && /^\d{4,8}$/.test(second)) {
                dateStr = second;
                title = parts.slice(2).join('-');
            } else {
                title = parts.slice(1).join('-');
            }

            var dateFormatted = '';
            if (dateStr) {
                var d = dateStr.replace(/[^\d]/g, '');
                if (d.length === 8) dateFormatted = d.slice(0, 4) + '年' + d.slice(4, 6) + '月' + d.slice(6, 8) + '日';
                else if (d.length === 6) dateFormatted = d.slice(0, 4) + '年' + d.slice(4, 6) + '月';
                else if (d.length === 4) dateFormatted = d + '年';
            }

            return { author: author, date: dateFormatted, title: title || '' };
        }

        function updateImageInfo(filename) {
            if (!imageInfoEl) return;
            var meta = parseFileName(filename);
            var infoText = '';
            if (meta.author) infoText += '作者：' + meta.author;
            if (meta.date) infoText += infoText ? ' · ' + meta.date : meta.date;
            if (infoText) {
                imageInfoEl.textContent = infoText;
                imageInfoEl.style.display = 'block';
            } else {
                imageInfoEl.style.display = 'none';
            }
        }

        function getRandomImage() {
            if (!randomImageEl) return;
            var newIndex;
            do {
                newIndex = Math.floor(Math.random() * xiaoluImages.length);
            } while (newIndex === currentImageIndex && xiaoluImages.length > 1);

            currentImageIndex = newIndex;
            var imgUrl = xiaoluImages[currentImageIndex];

            if (imgUrl.indexOf('img/') !== 0) {
                imgUrl = IMAGE_FOLDER + encodeURIComponent(imgUrl);
                updateImageInfo(xiaoluImages[currentImageIndex]);
            } else if (imageInfoEl) {
                imageInfoEl.style.display = 'none';
            }

            randomImageEl.style.opacity = '0';
            setTimeout(function () {
                randomImageEl.src = imgUrl;
                randomImageEl.style.opacity = '1';
            }, 200);
        }

        getRandomImage();

        if (window.GD) {
            GD.loadGreendamImages()
                .then(function (urls) {
                    if (!urls.length) return;
                    xiaoluImages = urls;
                    console.log('%c✅ 已加载 greendam.icu 图库，共 ' + urls.length + ' 张图片', 'color: #228B22;');
                    getRandomImage();
                })
                .catch(function () {
                    console.log('%c⚠️ greendam.icu 图库加载失败，使用本地图片', 'color: #ff6b9d;');
                });
        }

        if (refreshBtn) refreshBtn.addEventListener('click', getRandomImage);
        if (randomImageEl) {
            randomImageEl.addEventListener('click', getRandomImage);
            randomImageEl.style.cursor = 'pointer';
        }
    });
})();
