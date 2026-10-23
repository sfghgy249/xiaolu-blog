/* 页脚：以前七份复制、game.html 还漏了一次；现在统一由这里注入 */
(function () {
    'use strict';
    var HTML =
        '<div class="footer-content">' +
        '<div class="footer-section">' +
        '<h4>🌱 小绿的博客</h4>' +
        '<p>绿色上网 · 花季护航<br>守护每一份纯真与美好</p>' +
        '</div>' +
        '<div class="footer-section">' +
        '<h4>🔗 导航</h4>' +
        '<ul>' +
        '<li><a href="index.html">首页</a></li>' +
        '<li><a href="articles.html">文章</a></li>' +
        '<li><a href="gallery.html">相册</a></li>' +
        '<li><a href="video.html">视频</a></li>' +
        '<li><a href="game.html">小游戏</a></li>' +
        '<li><a href="memories.html">记忆</a></li>' +
        '<li><a href="rumors.html">留言墙</a></li>' +
        '<li><a href="about.html">关于</a></li>' +
        '</ul>' +
        '</div>' +
        '<div class="footer-section">' +
        '<h4>💚 游戏</h4>' +
        '<p>来玩小绿吃豆人吧！<br>' +
        '<a href="game.html" class="footer-link">点击进入游戏 →</a></p>' +
        '</div>' +
        '</div>' +
        '<div class="footer-bottom">' +
        '<p>© 2009 - 2026 小绿（格林达姆）· 绿坝-花季护航</p>' +
        '<p class="footer-note">Made with 💚 for healthy internet</p>' +
        '</div>';

    function inject() {
        var el = document.getElementById('site-footer');
        if (el) el.innerHTML = HTML;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inject);
    } else {
        inject();
    }
})();
