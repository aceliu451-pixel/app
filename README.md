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
