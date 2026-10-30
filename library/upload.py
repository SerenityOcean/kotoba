"""把资料（资料包、随笔）传到网站上。没有后台页面，内容写在文件里，用这个脚本传。

    python3 library/upload.py library/content                      # 传到本地后端
    python3 library/upload.py library/content https://kotoba.work  # 传到线上
    python3 library/upload.py --codes basics-n5 20 https://kotoba.work   # 给一个包生成 20 张兑换码

目录里：
    packs/*.json   一个文件一个包，slug 和接口要的字段都在里面（见 library/example/packs）
    essays/*.md    一个文件一篇随笔，开头一段 --- 包起来的头信息（见 library/example/essays）

先传包、再传随笔（随笔可能挂在包上）。按 slug 整份覆盖：改了文件再传一次就是更新。
要用 SELF_OWNER 配的那个账号登录（默认 keshi），密码运行时输入，不落盘。

付费内容别放进 git：仓库是公开的。library/content/ 已经在 .gitignore 里，真的内容写在那儿。
"""

import getpass
import http.cookiejar
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path


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
            with self.opener.open(req, timeout=120) as resp:
                raw = resp.read()
                return resp.status, json.loads(raw) if raw else None
        except urllib.error.HTTPError as e:
            raw = e.read()
            try:
                return e.code, json.loads(raw)
            except ValueError:
                return e.code, {"message": raw.decode(errors="replace")[:200]}


def fail(message):
    sys.exit(f"失败：{message}")


def sign_in(client):
    username = os.environ.get("KOTOBA_OWNER") or input("主人账号（SELF_OWNER）：").strip()
    password = os.environ.get("KOTOBA_OWNER_PASSWORD") or getpass.getpass(f"{username} 的密码：")
    status, body = client.request("POST", "/api/auth/login", {"username": username, "password": password})
    if status != 200:
        fail(f"登录不了（{status}）：{(body or {}).get('message')}")


def read_essay(path):
    """--- 包起来的头信息（key: value 一行一个），下面是正文。"""
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        fail(f"{path.name} 开头要有一段 --- 包起来的头信息")
    head, _, body = text[4:].partition("\n---\n")
    meta = {}
    for line in head.splitlines():
        if ":" in line:
            key, _, value = line.partition(":")
            meta[key.strip()] = value.strip()
    if "slug" not in meta or "title" not in meta:
        fail(f"{path.name} 的头信息里要有 slug 和 title")
    return meta["slug"], {
        "title": meta["title"],
        "pack": meta.get("pack") or None,
        "published": meta.get("published") or None,
        "sort": int(meta["sort"]) if meta.get("sort") else 0,
        "body": body.strip(),
    }


def upload(client, folder):
    packs = sorted((folder / "packs").glob("*.json"))
    essays = sorted((folder / "essays").glob("*.md"))
    if not packs and not essays:
        fail(f"{folder} 下面没有 packs/*.json，也没有 essays/*.md")

    for path in packs:
        pack = json.loads(path.read_text(encoding="utf-8"))
        slug = pack.pop("slug")
        status, body = client.request("PUT", f"/api/library/admin/packs/{slug}", pack)
        if status != 200:
            fail(f"资料包 {slug}（{path.name}）传不上去（{status}）：{(body or {}).get('message')}")
        content = pack["content"]
        print(f"  包   {slug:<20} {pack['status']:<8} {len(content['cards'])} 张卡，{len(content['articles'])} 篇文章")

    for path in essays:
        slug, essay = read_essay(path)
        status, body = client.request("PUT", f"/api/library/admin/essays/{slug}", essay)
        if status != 200:
            fail(f"随笔 {slug}（{path.name}）传不上去（{status}）：{(body or {}).get('message')}")
        where = f"挂在 {essay['pack']}" if essay["pack"] else "谁都能读"
        when = essay["published"] or "草稿"
        print(f"  随笔 {slug:<20} {where}，{when}")


def codes(client, slug, count):
    status, body = client.request("POST", f"/api/library/admin/packs/{slug}/codes", {"count": count})
    if status != 200:
        fail(f"生成不了兑换码（{status}）：{(body or {}).get('message')}")
    print("\n".join(body["codes"]))


def main():
    args = sys.argv[1:]
    if args[:1] == ["--codes"]:
        if len(args) < 3:
            fail("用法：upload.py --codes <包的 slug> <张数> [网站地址]")
        client = Client(args[3] if len(args) > 3 else "http://127.0.0.1:8080")
        sign_in(client)
        codes(client, args[1], int(args[2]))
        return

    if not args:
        fail("用法：upload.py <内容目录> [网站地址]")
    folder = Path(args[0])
    base = args[1] if len(args) > 1 else "http://127.0.0.1:8080"
    client = Client(base)
    sign_in(client)
    print(f"往 {base} 传 {folder}：")
    upload(client, folder)


if __name__ == "__main__":
    main()
