# 部署说明

服务器：阿里云轻量应用服务器，新加坡地域，Ubuntu 24.04，2 vCPU / 2 GiB
访问地址：https://kotoba.work（SSH 别名 `kotoba`，见 ~/.ssh/config）

## 服务器上的文件

| 路径 | 说明 |
|---|---|
| `/home/keshi/kotoba/app.jar` | 后端可执行 jar |
| `/home/keshi/kotoba/docker-compose.yml` | 线上 Postgres 配置 |
| `/home/keshi/kotoba/.env` | **数据库密码、模型 API key，不进仓库** |
| `/var/www/kotoba/` | 前端打包产物 |
| `/etc/nginx/sites-available/kotoba` | Nginx 站点配置 |
| `/etc/systemd/system/kotoba.service` | 后端服务定义 |

本目录下的几个文件是上述配置的副本，改动时**两边都要改**。

## 发布后端

    cd backend
    ./mvnw clean package
    rsync -P -e ssh target/kotoba-0.0.1-SNAPSHOT.jar kotoba:~/kotoba/app.jar
    ssh -t kotoba "sudo systemctl restart kotoba"
    ssh kotoba "journalctl -u kotoba -n 20 --no-pager"

等日志出现 `Started KotobaApplication in x.x seconds`（这台机器约 20 秒）。

踩过的坑：

- **不要加 `-DskipTests`** —— 测试不过就不该发布
- **`ssh` 必须加 `-t`** —— 不分配终端的话 sudo 读不到密码，会直接失败
- **不要用 `sleep N` 判断服务就绪** —— 用日志或 `systemctl is-active`。
  sleep 猜的是时间，机器慢一点就猜错，而且错得很隐蔽
- 用 `rsync -P` 而不是 `scp`：跨境链路会断，rsync 重跑能续传

## 发布前端

    cd frontend
    npm run build
    rsync -rP --delete -e ssh dist/ kotoba:/var/www/kotoba/

**必须用 `rsync --delete`，不要用 `scp -r`**：scp 是覆盖不是替换，旧的带
hash 的 js 会永远留在服务器上。配合浏览器缓存，你会连着旧 html 和旧 js
一起跑 —— 页面看着完全正常，跑的却是上个版本，而且察觉不到。

nginx 已经给 `index.html` 设了 `no-cache`、给 `/assets/` 设了长缓存，
所以正常刷新就够，不用每次 `Cmd+Shift+R`。

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
- 会话 cookie 是 `SameSite=Strict` + `Secure`（`.env` 里 `COOKIE_SECURE=true`）。

## 排查

    sudo systemctl status kotoba
    journalctl -u kotoba -f
    docker compose ps
    sudo nginx -t
