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

## 登录相关

- session 存在后端内存里，`systemctl restart kotoba` 之后所有人要重新登录。
- 会话 cookie 是 `SameSite=Strict`；等哪天上了 HTTPS，在 `.env` 里补一条
  `SERVER_SERVLET_SESSION_COOKIE_SECURE=true`。

## 排查

    sudo systemctl status kotoba
    journalctl -u kotoba -f
    docker compose ps
    sudo nginx -t
