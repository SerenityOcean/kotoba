# 部署说明

服务器：阿里云轻量应用服务器，新加坡地域，Ubuntu 24.04，2 vCPU / 2 GiB
访问地址：http://47.79.225.22

## 架构

## 服务器上的文件

| 路径 | 说明 |
|---|---|
| `/home/keshi/kotoba/app.jar` | 后端可执行 jar |
| `/home/keshi/kotoba/docker-compose.yml` | 线上 Postgres 配置 |
| `/home/keshi/kotoba/.env` | **数据库密码，权限 600，不进仓库** |
| `/var/www/kotoba/` | 前端打包产物 |
| `/etc/nginx/sites-available/kotoba` | Nginx 站点配置 |
| `/etc/systemd/system/kotoba.service` | 后端服务定义 |

本目录下三个文件是上述配置的副本，改动时**两边都要改**。

## 发布后端

    cd backend
    ./mvnw clean package
    scp target/*.jar keshi@47.79.225.22:~/kotoba/app.jar
    ssh -t keshi@47.79.225.22 "sudo systemctl restart kotoba"
    ssh keshi@47.79.225.22 "journalctl -u kotoba -n 20 --no-pager"

等日志出现 `Started KotobaApplication in x.x seconds`（这台机器约 20 秒）。

- **不要加 `-DskipTests`**：测试不过就不该发布
- **`ssh` 必须加 `-t`**：不分配终端的话 sudo 无法读密码
- **不要用 `sleep N` 判断服务就绪**，用日志或 `systemctl status`

## 发布前端

    cd frontend
    npm run build
    scp -r dist/* keshi@47.79.225.22:/var/www/kotoba/

浏览器用 `Cmd+Shift+R` 强制刷新，否则可能拿到缓存的旧 js。

注意 `scp -r` 是覆盖不是替换，旧的带 hash 的 js 文件会残留在服务器上。

## 改 Nginx 配置

    # 改 deploy/nginx-kotoba.conf，同步到服务器
    scp deploy/nginx-kotoba.conf keshi@47.79.225.22:/tmp/
    ssh -t keshi@47.79.225.22 "sudo mv /tmp/nginx-kotoba.conf /etc/nginx/sites-available/kotoba && sudo nginx -t && sudo systemctl reload nginx"

`nginx -t` 必须先过再 reload。`reload` 不中断正在处理的请求，比 `restart` 好。

## 排查

    ssh keshi@47.79.225.22

    systemctl status kotoba --no-pager     # 此刻的状态
    journalctl -u kotoba -n 50 --no-pager  # 历史日志
    journalctl -u kotoba -f                # 实时跟踪，Ctrl+C 退出
    docker compose -f ~/kotoba/docker-compose.yml ps
    curl localhost:8080/api/ping           # 绕过 Nginx 直测后端
    curl -I localhost                      # 测 Nginx
    free -h

远程执行命令时加 `--no-pager`，否则会卡在分页器里。

### 读日志

日志是时间线，**最后一行不等于当前状态**。看此刻用 `systemctl status`，看历史用 `journalctl`。
`Graceful shutdown` 表示收到 SIGTERM 正常停止，不是崩溃。

### 数据库

    docker exec -it kotoba-db psql -U kotoba -d kotoba

    \dt              列出所有表
    \d card          查看表结构
    \q               退出

## 已知技术债

- **`card.front` 没有唯一约束**。批量导入的去重是应用层 check-then-act，并发下会产生重复数据。上 Flyway 之后应补一个唯一索引。
- **`ddl-auto=update`** 只适合开发期：删字段不会删列、改字段名会多出一列。应换成 Flyway 迁移脚本。
- **部署全手工**。应改为 GitHub Actions：push 到 main → 自动构建 → 自动上传 → 自动重启。
- **前端产物残留**：发布时应先清空 `/var/www/kotoba/` 再上传。
