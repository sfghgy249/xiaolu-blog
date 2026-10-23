# -*- coding: utf-8 -*-
"""脚本公共库。

以前脱敏、原子写、时区、代理、token 在五个脚本里各写一份，规则还不一样。
现在统一从这里取，改规则只改一处。
"""

import base64
import json
import os
import re
import subprocess
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser

# ---------- 时间 ----------
# 全站按北京时间说事。以前 daily_memory_summary / log_event 用 naive 的 datetime.now()，
# 容器是 UTC 时"今天"就成了昨天，日期边界会错一天。
CST = timezone(timedelta(hours=8))


def now_cst():
    return datetime.now(CST)


def today_cst():
    return now_cst().strftime('%Y-%m-%d')


def log(*args):
    print(*args, file=sys.stderr)


# ---------- 读写 ----------
def read_json(path, default=None):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return default
    except json.JSONDecodeError as e:
        log('[warn] %s 不是合法 JSON：%s' % (path, e))
        return default


def write_json(path, data, indent=4):
    """先写同目录临时文件再 os.replace：断电或并发不会留下被截断的半个文件。"""
    directory = os.path.dirname(os.path.abspath(path)) or '.'
    os.makedirs(directory, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=directory, prefix='.tmp-', suffix='.json')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=indent)
            f.write('\n')
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def append_line(path, line):
    os.makedirs(os.path.dirname(os.path.abspath(path)) or '.', exist_ok=True)
    with open(path, 'a', encoding='utf-8') as f:
        f.write(line.rstrip('\n') + '\n')


# ---------- 脱敏 ----------
# 顺序很重要：先长后短。原来 $(?<!\d)[1-9]\d{4,11}(?!\d)$ 因为两头卡数字，
# 18 位身份证和 19 位银行卡一位都遮不住。
PRIVACY_RULES = [
    (r'群号[:：]?\s*\d+', '群号: 「已隐藏」'),                                 # 群号要在 QQ 号之前，否则被当成 QQ
    (r'\b\d{17}[\dXx]\b', '「已隐藏」'),                                   # 身份证
    (r'\b\d{16,19}\b', '「已隐藏」'),                                      # 银行卡
    (r'(?:\+?86[-\s]?)?1[3-9]\d[-\s]?\d{4}[-\s]?\d{4}', '「手机号」'),  # 手机号（含分隔符和 +86）
    (r'\b[1-9]\d{4,11}\b', '「QQ号」'),                                    # QQ 号
    (r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '「邮箱」'),
    (r'gh[pousr]_[A-Za-z0-9]{20,}', '「已隐藏」'),                            # GitHub token
    (r'github_pat_[A-Za-z0-9_]{20,}', '「已隐藏」'),
    (r'sk-[A-Za-z0-9_-]{16,}', '「已隐藏」'),                                 # 各类 API key
    (r'\b[a-zA-Z0-9_-]{24}\.[a-zA-Z0-9_-]{6}\.[a-zA-Z0-9_-]{27,}\b', '「已隐藏」'),  # JWT
    (r'https?://\S+', '「链接」'),
    (r'@\S+', '「@某人」'),
]

_COMPILED = [(re.compile(p), r) for p, r in PRIVACY_RULES]


def redact(text):
    if text is None:
        return ''
    result = str(text)
    for pattern, repl in _COMPILED:
        result = pattern.sub(repl, result)
    return result


def redact_obj(obj):
    """递归脱敏，dict / list / 字符串都过一遍。"""
    if isinstance(obj, str):
        return redact(obj)
    if isinstance(obj, list):
        return [redact_obj(v) for v in obj]
    if isinstance(obj, dict):
        return {k: redact_obj(v) for k, v in obj.items()}
    return obj


# ---------- HTML 净化 ----------
# 页面那边已经统一走白名单；入库这里再拦一道，防住"模型输出越界"和"抓来的页面带标签"。
_RICH_KEEP = {'p', 'br', 'strong', 'em'}


class _Sanitizer(HTMLParser):
    # 这些标签连内容一起丢掉：光去标签会把脚本正文留在文章里
    _DROP = {'script', 'style', 'iframe', 'object', 'embed', 'template', 'svg'}

    def __init__(self):
        HTMLParser.__init__(self, convert_charrefs=True)
        self.parts = []
        self._dropping = 0

    def handle_starttag(self, tag, attrs):
        if tag in self._DROP:
            self._dropping += 1
            return
        if self._dropping:
            return
        if tag in _RICH_KEEP:
            self.parts.append('<' + tag + '>')

    def handle_startendtag(self, tag, attrs):
        if not self._dropping and tag == 'br':
            self.parts.append('<br>')

    def handle_endtag(self, tag):
        if tag in self._DROP:
            self._dropping = max(0, self._dropping - 1)
            return
        if self._dropping:
            return
        if tag in _RICH_KEEP and tag != 'br':
            self.parts.append('</' + tag + '>')

    def handle_data(self, data):
        if self._dropping:
            return
        self.parts.append(data.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'))


def escape(text):
    """纯文本转义，拼进 HTML 前用。"""
    return (str(text if text is not None else '')
            .replace('&', '&amp;').replace('<', '&lt;')
            .replace('>', '&gt;').replace('"', '&quot;'))


def sanitize_html(text):
    if not text:
        return ''
    parser = _Sanitizer()
    parser.feed(str(text))
    parser.close()
    return ''.join(parser.parts)


# ---------- 配置 ----------
def get_proxy():
    """空字符串表示直连。别再往代码里写内网地址了。"""
    return os.environ.get('PROXY', '').strip()


def get_gh_token():
    token = os.environ.get('GH_TOKEN', '') or os.environ.get('NEKRO_RESOURCE_GITHUB_GITHUB', '')
    if not token:
        token_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.gh_token')
        if os.path.exists(token_file):
            with open(token_file, 'r', encoding='utf-8') as f:
                token = f.read().strip()
    return token


def get_env(name, default=''):
    return os.environ.get(name, default).strip()


def require_env(name, hint=''):
    value = get_env(name)
    if not value:
        raise SystemExit('缺少环境变量 %s%s' % (name, ('（' + hint + '）') if hint else ''))
    return value


# ---------- git ----------
def run(cmd, cwd=None, env=None, check=True):
    result = subprocess.run(
        cmd, cwd=cwd, env=env, capture_output=True, text=True, encoding='utf-8', errors='replace'
    )
    if check and result.returncode != 0:
        raise RuntimeError('命令失败：%s\n%s' % (' '.join(cmd), (result.stderr or '').strip()))
    return result


def git_remote_url(repo_dir, remote='origin'):
    return run(['git', 'remote', 'get-url', remote], cwd=repo_dir).stdout.strip()


def git_push(repo_dir, token, branch='main', remote='origin'):
    """用 GIT_CONFIG_* 环境变量单次注入凭据，不进命令行也不写进 .git/config。

    原点那版是 f'https://user:{token}@github.com/...' 写进 remote，出错的分支不还原，
    token 就明明白白躺在 .git/config 里。
    """
    if not token:
        raise RuntimeError('没有 GitHub token，无法推送')

    env = dict(os.environ)
    env['GIT_TERMINAL_PROMPT'] = '0'
    env.pop('GIT_ASKPASS', None)
    secret = base64.b64encode(('x-access-token:' + token).encode('utf-8')).decode('ascii')
    env['GIT_CONFIG_COUNT'] = '1'
    env['GIT_CONFIG_KEY_0'] = 'http.extraheader'
    env['GIT_CONFIG_VALUE_0'] = 'AUTHORIZATION: basic ' + secret
    try:
        return run(['git', 'push', remote, branch], cwd=repo_dir, env=env)
    finally:
        # 值只在子进程环境里活一次，退出即散
        secret = None


def git_commit(repo_dir, message, files=None):
    """files 给了就只加这几个文件，没给就 add -A。返回是否真的产生了提交。"""
    if files:
        run(['git', 'add', '--'] + list(files), cwd=repo_dir)
    else:
        run(['git', 'add', '-A'], cwd=repo_dir)
    staged = run(['git', 'diff', '--cached', '--name-only'], cwd=repo_dir).stdout.strip()
    if not staged:
        return False
    run(['git', 'commit', '-m', message], cwd=repo_dir)
    return True


# ---------- OneBot ----------
def onebot_call(base, token, action, params, timeout=20):
    import urllib.request
    body = json.dumps(params).encode('utf-8')
    req = urllib.request.Request(base.rstrip('/') + '/' + action, data=body, method='POST')
    req.add_header('Content-Type', 'application/json')
    if token:
        req.add_header('Authorization', 'Bearer ' + token)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode('utf-8'))
