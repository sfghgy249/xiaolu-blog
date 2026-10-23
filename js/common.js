/* 公共工具：所有写入 DOM 的内容都必须经过这里 */
/* 挂到 window.GD 上，页面脚本一律用 GD.xxx，不再各写一套 */
(function (global) {
    'use strict';

    var RICH_BLOCK = { P: 1, DIV: 1, LI: 1, BLOCKQUOTE: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1 };
    var RICH_KEEP = { P: 1, BR: 1, STRONG: 1, EM: 1, B: 1, I: 1 };

    /* 纯文本转义：拼进 innerHTML 或属性前必须过一遍 */
    function escapeHtml(value) {
        return String(value === null || value === undefined ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /* 富文本白名单净化：只留段落与强调，属性全丢，链接仅允许 http(s) */
    function sanitizeRich(html) {
        var tpl = document.createElement('template');
        tpl.innerHTML = String(html === null || html === undefined ? '' : html);
        var out = document.createDocumentFragment();

        function walk(src, dest) {
            Array.prototype.forEach.call(src.childNodes, function (node) {
                if (node.nodeType === 3) {
                    dest.appendChild(document.createTextNode(node.nodeValue));
                    return;
                }
                if (node.nodeType !== 1) return;
                var tag = node.tagName.toUpperCase();

                if (tag === 'A') {
                    var href = node.getAttribute('href') || '';
                    if (!/^https?:\/\//i.test(href)) {
                        walk(node, dest);
                        return;
                    }
                    var a = document.createElement('a');
                    a.setAttribute('href', href);
                    a.setAttribute('target', '_blank');
                    a.setAttribute('rel', 'noopener noreferrer');
                    a.textContent = node.textContent;
                    dest.appendChild(a);
                    return;
                }
                if (tag === 'B' || tag === 'I') {
                    var mapped = document.createElement(tag === 'B' ? 'strong' : 'em');
                    walk(node, mapped);
                    dest.appendChild(mapped);
                    return;
                }
                if (RICH_KEEP[tag]) {
                    var el = document.createElement(tag);
                    if (tag === 'BR') dest.appendChild(el);
                    else { walk(node, el); dest.appendChild(el); }
                    return;
                }
                walk(node, dest);
                if (RICH_BLOCK[tag]) dest.appendChild(document.createElement('br'));
            });
        }

        walk(tpl.content, out);
        var box = document.createElement('div');
        box.appendChild(out);
        return box.innerHTML;
    }

    /* 去掉全部标签，拿纯文本 */
    function plainText(html) {
        var box = document.createElement('div');
        box.innerHTML = String(html === null || html === undefined ? '' : html);
        return (box.textContent || '').replace(/\s+/g, ' ').trim();
    }

    async function fetchJSON(url, fallback) {
        var res = await fetch(url, { cache: 'no-cache' });
        if (!res.ok) throw new Error(url + ' ' + res.status);
        var data = await res.json();
        if (!data) throw new Error(url + ' 返回空');
        return data;
    }

    /* greendam.icu 的 images.js 只导出一个 IMAGES 数组，三处页面都用，收在这里 */
    var IMAGES_JS_URL = 'https://greendam.icu/js/images.js';
    var imagesPromise = null;
    function loadGreendamImages() {
        if (imagesPromise) return imagesPromise;
        imagesPromise = fetch(IMAGES_JS_URL, { cache: 'force-cache' })
            .then(function (r) { return r.text(); })
            .then(function (text) {
                var match = text.match(/const IMAGES = \[([\s\S]*?)\];/);
                if (!match) throw new Error('IMAGES 数组没找到');
                return (match[1].match(/["']([^"']+)["']/g) || []).map(function (s) {
                    return s.slice(1, -1);
                });
            })
            .catch(function (e) {
                imagesPromise = null;
                throw e;
            });
        return imagesPromise;
    }

    function formatDate(value) {
        if (!value) return '';
        var d = new Date(value);
        if (isNaN(d.getTime())) return String(value);
        var p = function (n) { return n < 10 ? '0' + n : String(n); };
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    }

    /* 统一分页条：上次三份抄来抄去，这里就一份 */
    function renderPagination(container, totalPages, currentPage, onGo) {
        if (!container) return;
        if (!totalPages || totalPages <= 1) {
            container.innerHTML = '';
            return;
        }
        var html = '';
        html += '<a href="#" class="page-link' + (currentPage <= 1 ? ' disabled' : '') +
            '" data-page="' + (currentPage - 1) + '">« 上一页</a>';
        for (var i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1) {
                html += '<a href="#" class="page-link' + (i === currentPage ? ' active' : '') +
                    '" data-page="' + i + '">' + i + '</a>';
            } else if (Math.abs(i - currentPage) === 2) {
                html += '<span class="page-dots">...</span>';
            }
        }
        html += '<a href="#" class="page-link' + (currentPage >= totalPages ? ' disabled' : '') +
            '" data-page="' + (currentPage + 1) + '">下一页 »</a>';
        container.innerHTML = html;

        Array.prototype.forEach.call(
            container.querySelectorAll('.page-link:not(.disabled)'),
            function (el) {
                el.addEventListener('click', function (e) {
                    e.preventDefault();
                    var page = parseInt(el.getAttribute('data-page'), 10);
                    if (!isNaN(page) && typeof onGo === 'function') onGo(page);
                });
            }
        );
    }

    global.GD = {
        escapeHtml: escapeHtml,
        sanitizeRich: sanitizeRich,
        plainText: plainText,
        fetchJSON: fetchJSON,
        loadGreendamImages: loadGreendamImages,
        formatDate: formatDate,
        renderPagination: renderPagination
    };
})(window);
