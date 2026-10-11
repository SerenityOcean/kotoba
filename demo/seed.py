"""建 N5 / N4 / N3 三个演示账号，各带一个卡包、三篇阅读和一个备考目标。

    python3 demo/seed.py                        # 本地后端（http://127.0.0.1:8080）
    python3 demo/seed.py https://kotoba.work    # 线上

走的是网站自己的接口（注册、导入卡片、存文章、设目标），和真人操作一样。
密码随机生成，记在 demo/accounts.<主机名>.txt（不进 git）。再跑一次是安全的：
账号已存在就用记下的密码登录，包里已有的卡和同名文章会跳过。

素材在同目录的 n5.json / n4.json / n3.json：卡片背面沿用 Anki 词汇包的五行格式
（读音、词性、释义、例句、翻译），例句和文章的注音已经人工核对过。
"""

import datetime
import http.cookiejar
import json
import secrets
import string
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
LEVELS = ["n5", "n4", "n3"]


class Client:
    """带 cookie 的会话。后端开了 CSRF：写请求要把 XSRF-TOKEN cookie 抄进请求头。"""

    def __init__(self, base):
        self.base = base.rstrip("/")
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))

    def request(self, method, path, body=None):
        if method != "GET":
            # 登录后 CSRF 令牌会换，每次写之前刷一下
            self.request("GET", "/api/auth/features")
        headers = {"Content-Type": "application/json"}
        token = next((c.value for c in self.jar if c.name == "XSRF-TOKEN"), None)
        if token and method != "GET":
            headers["X-XSRF-TOKEN"] = token
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.base + path, data=data, method=method, headers=headers)
        try:
            with self.opener.open(req, timeout=60) as resp:
                raw = resp.read()
                return resp.status, json.loads(raw) if raw else None
        except urllib.error.HTTPError as e:
            raw = e.read()
            try:
                return e.code, json.loads(raw)
            except ValueError:
                return e.code, {"message": raw.decode(errors="replace")[:200]}


def next_jlpt_date(today):
    """下一次 JLPT：每年 7 月和 12 月的第一个星期日。"""
    for year in (today.year, today.year + 1):
        for month in (7, 12):
            first = datetime.date(year, month, 1)
            sunday = first + datetime.timedelta(days=(6 - first.weekday()) % 7)
            if sunday > today:
                return sunday
    raise AssertionError("unreachable")


def load_accounts(path):
    accounts = {}
    if path.exists():
        for line in path.read_text().splitlines():
            if ":" in line and not line.startswith("#"):
                user, _, password = line.partition(":")
                accounts[user.strip()] = password.strip()
    return accounts


def save_accounts(path, base, accounts):
    lines = [f"# {base} 的演示账号（用户名: 密码）。demo/seed.py 生成，不进 git。"]
    lines += [f"{user}: {password}" for user, password in accounts.items()]
    path.write_text("\n".join(lines) + "\n")
    path.chmod(0o600)


def new_password():
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(14))


def fail(message):
    sys.exit(f"失败：{message}")


def sign_in(client, username, accounts):
    """记过密码的直接登录，没记过的才注册 —— 注册每个 IP 一小时只能 5 次，别浪费在已有账号上。"""
    if username in accounts:
        status, body = client.request("POST", "/api/auth/login",
                                      {"username": username, "password": accounts[username]})
        if status == 200:
            return "已存在，已登录"
        fail(f"{username} 用记下的密码登录不了（{status}）：{(body or {}).get('message')}")

    password = new_password()
    status, body = client.request("POST", "/api/auth/register", {"username": username, "password": password})
    if status == 201:
        accounts[username] = password
        return "新建"
    if status == 409:
        fail(f"{username} 已经被注册了，但本地没有它的密码（demo/accounts.*.txt）")
    fail(f"{username} 注册不了（{status}）：{(body or {}).get('message')}")


def seed_level(base, level, accounts, jlpt):
    data = json.loads((HERE / f"{level}.json").read_text(encoding="utf-8"))
    client = Client(base)
    username = data["username"]
    how = sign_in(client, username, accounts)

    status, result = client.request("POST", "/api/cards/import", {"cards": data["cards"], "deckName": data["deck"]})
    if status != 200:
        fail(f"{username} 导入卡片失败（{status}）：{(result or {}).get('message')}")

    status, page = client.request("GET", "/api/articles?" + urllib.parse.urlencode({"size": 100}))
    existing = {a["title"] for a in (page or {}).get("articles", [])}
    added = 0
    for article in data["articles"]:
        if article["title"] in existing:
            continue
        status, body = client.request("POST", "/api/articles", article)
        if status != 201:
            fail(f"{username} 存文章《{article['title']}》失败（{status}）：{(body or {}).get('message')}")
        added += 1

    status, body = client.request("PUT", "/api/goal", {"title": data["goal"], "targetDate": jlpt.isoformat()})
    if status != 200:
        fail(f"{username} 设目标失败（{status}）：{(body or {}).get('message')}")

    print(f"  {data['level']}  {username:<8} {how}；卡包「{data['deck']}」新增 {result['imported']} 张"
          f"（跳过 {result['skipped']}），文章新增 {added} 篇，目标「{data['goal']}」{jlpt}")


def main():
    base = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8080"
    host = urllib.parse.urlparse(base).hostname or "local"
    accounts_file = HERE / f"accounts.{host}.txt"
    accounts = load_accounts(accounts_file)
    jlpt = next_jlpt_date(datetime.date.today())

    print(f"往 {base} 建演示账号：")
    try:
        for level in LEVELS:
            seed_level(base, level, accounts, jlpt)
    finally:
        # 中途失败也把已经建好的账号密码存下来，不然下次就登不上了
        if accounts:
            save_accounts(accounts_file, base, accounts)
    print(f"账号密码在 {accounts_file.relative_to(HERE.parent)}")


if __name__ == "__main__":
    main()
