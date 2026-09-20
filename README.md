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

## 卡片分包

卡片按「包」组织。升级到这一版时，原有卡片全部归入**默认包**；手动新建的卡片进
当前选中的包（选「全部」时进默认包）；导入 Anki 包会按包名新建一个包。

包名可以随时改（卡片页选中某个包 → 重命名）。删包会连里面的卡片一起删掉。

同一个词在不同包里可以各存一张，进度互不影响 —— 唯一约束是「包 + 正面」，
所以重复导入同一个包是安全的（会跳过），换个包名导入则会另存一份。

首页除了「开始复习」（全部到期卡片混在一起），还能按包单独复习。

## 导入 Anki 牌组

卡片页 →「从 Anki 导入…」→ 选 `.apkg` 文件。解析全在浏览器里做（`jszip` 解包，
`sql.js` 读包里的 SQLite），只有映射好的正反面文本会发给后端，媒体文件不上传。

选好哪个字段当正面、哪些字段拼成背面，旁边有实时预览。`[sound:...]`、`<img>`
等标记会被去掉；同一个包重复导入是安全的（重复的词会跳过）。

### 振り仮名

包里的 `<ruby>` 注音会存成 Anki 的方括号记法 `諦[あきら]める`，显示时由
`Furigana` 组件渲染成真正的振り仮名 —— 假名排在汉字上方，而不是挤在括号里。
手动建卡也能用这个记法，正面输入 `勉強[べんきょう]` 就会带注音。

默认映射把**不带注音**的字段放正面（不剧透读音），背面放读音、词性、释义和
带注音的例句，各段之间换行。不满意就在导入界面上重新勾。

Anki 2.1.50 之后导出的包用 zstd 压缩（`collection.anki21b`），浏览器里解不了 ——
导出时勾选「支持旧版 Anki」即可。
## 阅读

「阅读」页存你读过的文章，点进去读。

保存时会**给全文加上振假名**：正文按段落切块、并行调模型注音，再拼回去，
换行和空行原样保留。某一块注不上（模型改了正文，或者请求失败）就用原文，
不会因为注音失败丢掉文章 —— 存完会告诉你有几段是原样存的。

后端会校验模型只是插入了注音：把注音剥掉必须和原文一字不差，对不上就退回
原文。让模型重写整段正文是有风险的，它可能顺手改字删句，而那种错误读者
根本发现不了。

读的时候**选中任意一段文字，底部会弹出拆解结果**，勾选就能建成卡片 ——
读、查、记在同一页闭环。这一块和「拆解」页用的是同一套逻辑（`useAnalysis`）。

## AI 拆解

「拆解」页：粘一段日语进去，模型逐句给出中文翻译、动词活用讲解和语法点，
每条都能勾选，一键变成卡片（走的是批量导入那条路，重复的会自动跳过），
可以选存进哪个包。

要用这个功能得配一个模型服务。支持两种，都只从环境变量读 key：

### OpenAI 兼容接口（默认）

百炼（通义）、DeepSeek、智谱都是这一套，区别只在 base-url 和 model。
以百炼为例：

    export ANALYZE_BASE_URL=https://你的WorkspaceId.cn-beijing.maas.aliyuncs.com/compatible-mode/v1
    export ANALYZE_API_KEY=sk-...
    export ANALYZE_MODEL=qwen3.7-plus
    cd backend && ./mvnw spring-boot:run

base-url 填到 `/v1` 为止，不要带 `/chat/completions`。百炼的地址带工作空间 id，
在控制台创建 key 的页面能看到；key 和地址是绑定区域的，别混用。

### Anthropic

    export ANALYZE_PROVIDER=anthropic
    export ANTHROPIC_API_KEY=sk-ant-...

注意 Anthropic 的 API 额度和 Claude.ai 的订阅是两套账，要在 Console 的
Plans & Billing 里单独充值。

### 说明

没配 key 也不影响别的：应用照常启动，只有 `/api/analyze` 回 503。

两条路共用同一份 JSON schema，从 `Analysis` 那几个 record 推出来
（`AnalysisSchema`）—— 改拆解的输出格式只要改 record，两边自动跟上。

## 登录

第一次用要先注册：打开前端 → 「注册」→ 填用户名和密码（至少 8 位）。

数据库里原来那个 `keshi` 账号如果密码还是迁移脚本留下的占位值 `NOT_SET`，
用同名注册就是「认领」它 —— 密码设上，原来的卡片都还在。
忘了密码也走这条路：

    UPDATE app_user SET password_hash = 'NOT_SET' WHERE username = 'keshi';

然后重新注册一次即可。

登录态是服务端 session + cookie，保留 30 天。后端重启会把 session 清空
（存在内存里），所有人需要重新登录一次。
