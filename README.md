# kotoba

日语单词/句子的间隔重复复习系统。

## 技术栈

- 前端：React + TypeScript + Vite
- 后端：Spring Boot 3 + Java 21
- 数据库：PostgreSQL

## 本地启动

### 后端

    cd backend
    ./mvnw spring-boot:run

服务跑在 http://localhost:8080

## 登录

第一次用要先注册：打开前端 → 「注册」→ 填用户名和密码（至少 8 位）。

数据库里原来那个 `keshi` 账号如果密码还是迁移脚本留下的占位值 `NOT_SET`，
用同名注册就是「认领」它 —— 密码设上，原来的卡片都还在。
忘了密码也走这条路：

    UPDATE app_user SET password_hash = 'NOT_SET' WHERE username = 'keshi';

然后重新注册一次即可。

登录态是服务端 session + cookie，保留 30 天。后端重启会把 session 清空
（存在内存里），所有人需要重新登录一次。
