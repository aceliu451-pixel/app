<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# TaskFlow

任务进度追踪、每日备忘和完成复盘工具。

View your app in AI Studio: https://ai.studio/apps/04af8922-11bc-4adf-aa8c-84d8c5cc618a

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Production Build

```bash
npm run build
```

The production files are generated in `dist/`.

## Deploy

This app is ready for static hosting:

- Vercel: build command `npm run build`, output directory `dist`
- Netlify: build command `npm run build`, publish directory `dist`
- Cloudflare Pages: build command `npm run build`, output directory `dist`

## TaskFlow 跨设备同步

现有 Vercel 项目需要连接一个 **Private** Vercel Blob Store。确认 Production 环境有 `BLOB_READ_WRITE_TOKEN`。在终端用 `openssl rand -hex 32` 生成一个配对码并保存在自己的密码管理器。将这个码的 SHA-256 十六进制摘要（对原始字符串计算，不含换行）设为项目 Production 的 `TASKFLOW_SYNC_KEY_SHA256`。重新部署后，API 会校验配对码，任务记录存入私有 Blob。

先从手机原来的 TaskFlow 图标打开新版，点 **同步**，输入配对码。看到 **已同步** 后，在电脑打开同一网站并输入同一个码。两个设备各自保留本机数据，离线编辑会在联网后重试。两个设备同时修改同一任务或同一天的备忘时，应用会暂停同步并请你选择版本。可以先在同步窗口下载两份备份。

手机旧记录仅能从原来使用的网址和 App 容器读取。新版首次打开时会读取旧版浏览器存储并保留原始副本。对于从旧局域网地址安装的图标，在原地址运行新版后可以下载本机备份，再导入线上版。Vercel 同步接口支持最多 4 MB 的任务和备忘数据。超出时本机编辑和下载备份仍可使用。
