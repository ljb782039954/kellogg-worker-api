### 部署/测试ExchangeRate

#### 1. **配置本地环境变量：**

    在 `worker-api` 文件夹下的 `.dev.vars` (这是 Wrangler 用于本地环境变量配置的标准文件)，加入你的 API Key：

    ```text
    EXCHANGE_RATE_API_KEY= your exchange rate api key
    ```

#### 2. **触发初始获取：**

    本地跑起 `worker-api` 测试服务后，你可以发个空请求调用上述接口，观察日志即可拉回最新汇率：

    - 1. 在终端输入：

    ```bash
    curl -X POST http://localhost:8787/api/system/update-rates
    ```

    - 2. _(如果你设置了 ADMIN_TOKEN，记得加上 `-H "Authorization: Bearer 你的Token"`)_

    - 在终端输入：

    ```bash
    curl -X POST http://localhost:8787/api/system/update-rates -H "Authorization: Bearer dev-admin-token"
    ```

    - 3. 如果是在 powershell 中，输入：

    ```powershell
    Invoke-RestMethod -Method Post -Uri http://localhost:8787/api/system/update-rates -Headers @{"Authorization"="Bearer dev-admin-token"}
    ```

##### 2.1 验证

    - 1. GET方法，在终端输入(或者浏览器中输入后面的链接)：

    ```bash
    curl http://localhost:8787/api/config/exchangeRates
    ```

#### 3. **配置线上环境变量：**

    当你准备部署到线上时，切记要在 Cloudflare （worker-api） 面板内的 Settings -> Variables and Secrets 里添加 `EXCHANGE_RATE_API_KEY`！

#### 4. 部署

    - 1. 在终端输入：

    ```bash
    npm run deploy

    ```

#### 5. 验证

    - 1. 在终端输入：

    ```bash
    curl https://kellogg-api.aimeexiang239.workers.dev/api/config/exchangeRates
    ```

#### 6. 如何手动触发

    - 1. 在终端输入：

    ```bash
    # 将下面的域名和 Token 换成你真实的线上信息

Invoke-RestMethod -Method Post `  -Uri "https://kellogg-api.aimeexiang239.workers.dev/api/system/update-rates"`
-Headers @{"Authorization"="Bearer kellogg-admin-token-Aimeexiang"}

    ```

当这套逻辑正常跑起来并确认能在 Dashboard 后台看到 KV 里存放好的 `exchangeRates` 后，我们随时可以开始进行 `webApp` 端的接入和美观渲染实现。
