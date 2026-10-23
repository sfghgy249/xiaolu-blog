// 关于页：随机放一张生日贺图
(function () {
    'use strict';
    document.addEventListener('DOMContentLoaded', async function () {
        var target = document.getElementById('birthdayImage');
        if (!target) return;
        try {
            var images = await GD.loadGreendamImages();
            var birthday = images.filter(function (img) {
                return img.indexOf('生日') !== -1 || img.indexOf('贺图') !== -1;
            });
            if (!birthday.length) return;
            var picked = birthday[Math.floor(Math.random() * birthday.length)];
            target.src = 'https://greendam.icu/images/' + encodeURIComponent(picked);
        } catch (e) {
            console.warn('生日贺图加载失败，保持默认图');
        }
    });
})();
