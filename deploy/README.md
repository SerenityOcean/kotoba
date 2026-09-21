# 部署说明

服务器：阿里云轻量，新加坡，Ubuntu 24.04

## 目录

- `/home/keshi/kotoba/` — app.jar、docker-compose.yml、.env（.env 不进仓库）
- `/var/www/kotoba/` — 前端打包产物
- `/etc/nginx/sites-available/kotoba` — Nginx 配置
- `/etc/systemd/system/kotoba.service` — 后端服务

## 发布后端

    cd backend
    ./mvnw clean package -DskipTests
    scp target/*.jar keshi@<IP>:~/kotoba/app.jar
    ssh keshi@<IP> "sudo systemctl restart kotoba"

## 发布前端

    cd frontend
    npm run build
    scp -r dist/* keshi@<IP>:/var/www/kotoba/

## HTTPS

域名 kotoba.work 的 A 记录（@ 和 www）指向本机。证书用 Let's Encrypt，
certbot 只负责签发（certonly），nginx 配置由仓库里的
`deploy/nginx-kotoba.conf` 管 —— 不用 `--nginx` 插件，免得它改写配置、
和仓库里这份走散。

**顺序不能反**：443 的配置引用证书文件，证书不存在时 `nginx -t` 直接失败。

1. 阿里云轻量控制台 → 防火墙 → 放行 443（不放行的话签完也访问不了）
2. 装 certbot：`sudo apt update && sudo apt install -y certbot`
3. 签证书（此时 nginx 还是 HTTP 版配置，验证文件走 /var/www/kotoba）：

       sudo certbot certonly --webroot -w /var/www/kotoba \
         -d kotoba.work -d www.kotoba.work \
         --agree-tos -m <你的邮箱> --no-eff-email

4. 把本仓库的 `deploy/nginx-kotoba.conf` 覆盖到
   `/etc/nginx/sites-available/kotoba`
5. `sudo nginx -t && sudo systemctl reload nginx`
6. 在 `~/kotoba/.env` 里加 `COOKIE_SECURE=true`，然后重启后端

### 续期

certbot 装好时会自带一个 systemd timer，每天跑两次、到期前自动续。
验证方式：

    sudo certbot renew --dry-run
    systemctl list-timers | grep certbot

续期走的是 80 端口上的 `/.well-known/acme-challenge/`，所以 nginx 里
那一段**不能跳转到 HTTPS** —— 跳了续期就会失败，而且失败得很安静，
直到 90 天后证书过期才暴露。

### HSTS

配置里留了一行注释掉的 `Strict-Transport-Security`。等 HTTPS 稳定跑几天
再打开：一旦下发，浏览器会在 max-age 期间强制只用 HTTPS，中途想退回
HTTP 调试就没办法了。

## 登录相关

- session 存在后端内存里，`systemctl restart kotoba` 之后所有人要重新登录。
- 会话 cookie 是 `SameSite=Strict`；等哪天上了 HTTPS，在 `.env` 里补一条
  `SERVER_SERVLET_SESSION_COOKIE_SECURE=true`。

## 排查

    sudo systemctl status kotoba
    journalctl -u kotoba -f
    docker compose ps
    sudo nginx -t
