// 留言墙：静态留言 + 在线留言板
(function () {
    'use strict';
    var esc = GD.escapeHtml;
    var RUMOR_API = 'https://api.ww3.tw/greendam/rumors/';

    document.addEventListener('DOMContentLoaded', async function () {
        var container = document.getElementById('rumorsContainer');

        try {
            var rumors = await GD.fetchJSON('data/rumors.json');
            rumors.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });

            container.innerHTML = rumors.map(function (rumor) {
                var dateStr = String(rumor.date || '').replace(/-/g, '年').replace(/年(\d+)$/, '月$1日');
                var tagsHtml = (rumor.tags && rumor.tags.length)
                    ? rumor.tags.map(function (t) { return '<span class="rumor-tag">#' + esc(t) + '</span>'; }).join('')
                    : '';
                return '<div class="rumor-card">' +
                    '<div class="rumor-header">' +
                    '<span class="rumor-nick">🌿 ' + esc(rumor.nickname || '匿名') + '</span>' +
                    '<span class="rumor-date">📅 ' + esc(dateStr) + '</span>' +
                    '</div>' +
                    '<div class="rumor-content">' + GD.sanitizeRich(rumor.content) + '</div>' +
                    '<div class="rumor-tags">' + tagsHtml + '</div>' +
                    '</div>';
            }).join('');

            setText('rumorCount', rumors.length);
            setText('latestDate', rumors[0] ? rumors[0].date : '-');
        } catch (e) {
            if (container) container.innerHTML = '<p style="text-align: center; color: #999;">公开留言加载失败，请刷新重试～</p>';
            console.error('加载公开留言失败:', e);
        }

        var localContainer = document.getElementById('localMessagesContainer');
        var localSubmitBtn = document.getElementById('localSubmitBtn');
        var localNameInput = document.getElementById('localName');
        var localMessageInput = document.getElementById('localMessage');
        var charCounter = document.getElementById('charCounter');

        if (localMessageInput && charCounter) {
            localMessageInput.addEventListener('input', function () {
                charCounter.textContent = localMessageInput.value.length + '/50';
            });
        }

        async function loadApiMessages() {
            if (!localContainer) return;
            try {
                var res = await fetch(RUMOR_API, { cache: 'no-cache' });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                var messages = await res.json();
                if (!Array.isArray(messages) || !messages.length) {
                    localContainer.innerHTML = '<p style="text-align: center; color: #888; font-size: 0.9rem;">还没有留言，快来抢沙发吧～</p>';
                    return;
                }
                var html = '<h4 style="color: var(--green-dark); margin: 1rem 0 0.8rem 0; font-size: 0.95rem;">📬 最新留言（所有访客可见）</h4>';
                messages.slice().reverse().forEach(function (msg) {
                    html += '<div class="local-message-item">' +
                        '<div class="local-message-header">' +
                        '<span class="local-message-author">🌱 ' + esc(msg.name || '匿名') + '</span>' +
                        '<span class="local-message-date">' + esc(msg.date || '') + '</span>' +
                        '</div>' +
                        '<div>' + esc(msg.content) + '</div>' +
                        '</div>';
                });
                localContainer.innerHTML = html;
            } catch (e) {
                localContainer.innerHTML = '<p style="text-align: center; color: #999; font-size: 0.9rem;">留言加载失败，请刷新重试～</p>';
                console.error('加载在线留言失败:', e);
            }
        }

        if (localSubmitBtn && localNameInput && localMessageInput) {
            localSubmitBtn.addEventListener('click', async function () {
                var name = localNameInput.value.trim() || '匿名';
                var content = localMessageInput.value.trim();
                if (!content) {
                    alert('请输入留言内容哦～');
                    return;
                }
                if (content.length > 50) {
                    alert('留言最多50个字哦～');
                    return;
                }

                localSubmitBtn.disabled = true;
                try {
                    var res = await fetch(RUMOR_API, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: name,
                            content: content,
                            date: new Date().toISOString().split('T')[0]
                        })
                    });
                    if (!res.ok) throw new Error('HTTP ' + res.status);

                    localNameInput.value = '';
                    localMessageInput.value = '';
                    charCounter.textContent = '0/50';
                    await loadApiMessages();
                    alert('留言提交成功！💚');
                } catch (e) {
                    alert('留言提交失败，请稍后重试～');
                    console.error('提交留言失败:', e);
                } finally {
                    localSubmitBtn.disabled = false;
                }
            });
        }

        loadApiMessages();
    });

    function setText(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value;
    }
})();
