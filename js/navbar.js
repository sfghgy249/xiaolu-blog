// 导航栏渲染逻辑 - 原生 JS 版（不再依赖 Vue，减少约 580KB 加载）
(function() {
    // 获取当前页面文件名，用于高亮 active
    const path = window.location.pathname;
    let currentPage = path.split('/').pop();
    // 根路径（https://xxx.com/ 或 https://xxx.com/xiaolu-blog/）默认是 index.html
    if (currentPage === '' || currentPage.endsWith('/') || currentPage === 'xiaolu-blog') {
        currentPage = 'index.html';
    }

    const ul = document.querySelector('#main-navbar');
    if (!ul) return;

    function renderNav(list) {
        ul.innerHTML = list.map(item => {
            const isActive = item.url === currentPage;
            return '<li><a href="' + item.url + '"' + (isActive ? ' class="active"' : '') + '>' + item.title + '</a></li>';
        }).join('');
    }

    // 降级处理：导航数据加载失败时显示默认静态导航
    function renderFallback() {
        ul.innerHTML = [
            '<li><a href="index.html">首页</a></li>',
            '<li><a href="articles.html">文章</a></li>',
            '<li><a href="gallery.html">相册</a></li>',
            '<li><a href="video.html">视频</a></li>',
            '<li><a href="game.html">🎮 小游戏</a></li>',
            '<li><a href="memories.html">回忆</a></li>',
            '<li><a href="rumors.html">💬 留言墙</a></li>',
            '<li><a href="about.html">关于</a></li>'
        ].join('');
    }

    fetch('data/navbar.json')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (Array.isArray(data) && data.length) {
                renderNav(data);
            } else {
                renderFallback();
            }
        })
        .catch(function() { renderFallback(); });
})();
