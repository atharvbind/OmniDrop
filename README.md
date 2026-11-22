# 💧 OmniDrop

> **Powered by [`omni-body`](https://www.npmjs.com/package/omni-body)** — The universal, zero-overhead body parser middleware for Node.js and Express.

OmniDrop demonstrates the **"Aha!" moment** of `omni-body`: a **SINGLE Express route (`POST /api/drop`)** that accepts and parses **JSON**, **Multipart file uploads**, **URL-encoded forms**, **Plain text / Markdown**, and **Raw binary buffers** without needing 4 conflicting middleware libraries (`multer`, `body-parser`, `raw-body`, etc.).

---

## ⚡ Quick Start (Local)

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server
```bash
npm start
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### 3. Run Automated Tests
```bash
npm test
```
Runs the CLI test suite ([test-client.ts](file:///Users/atharv/Documents/ASD/OmniDrop/test-client.ts)) which programmatically verifies all 5 payload categories + error handling against the running server.

---

## 🚀 Push to GitHub

To push this repository to your GitHub account:

1. **Create a new repository on GitHub** (e.g. `OmniDrop`).
2. Run the following commands in your terminal:

```bash
# Initialize git if not already initialized
git init

# Add all files and make initial commit
git add .
git commit -m "feat: initial commit of OmniDrop demo for omni-body"

# Rename branch to main
git branch -M main

# Link your GitHub remote (replace with your repo URL)
git remote add origin https://github.com/<your-username>/OmniDrop.git

# Push to GitHub
git push -u origin main
```

---

## ☁️ Deploy to Vercel

OmniDrop is pre-configured for Vercel deployment with [vercel.json](file:///Users/atharv/Documents/ASD/OmniDrop/vercel.json) and [api/index.ts](file:///Users/atharv/Documents/ASD/OmniDrop/api/index.ts). 

> **Important**: In [api/index.ts](file:///Users/atharv/Documents/ASD/OmniDrop/api/index.ts), `config.api.bodyParser: false` is configured so Vercel does not consume the incoming request stream, allowing `omni-body` to parse multipart files, raw binary, and JSON directly.

### Method 1: Deploy via Vercel Dashboard (Easiest)
1. Push your code to GitHub (as shown above).
2. Go to **[vercel.com](https://vercel.com)** and click **"Add New Project"**.
3. Import your **`OmniDrop`** GitHub repository.
4. Keep the default settings and click **"Deploy"**.
5. Your app is live!

### Method 2: Deploy via Vercel CLI
```bash
# Install Vercel CLI if needed
npm i -g vercel

# Deploy directly from terminal
vercel
```

---

## 💡 Why `omni-body`?

### ❌ Traditional Express (4+ Packages & Conflicting Streams)
```typescript
app.use(express.json());                         // Only handles JSON
app.use(express.urlencoded({ extended: true })); // Only handles Forms
const upload = multer({ dest: 'uploads/' });     // Only handles Multipart
// Raw body listeners fail because previous middlewares consumed the stream!
```

### ✨ The `omni-body` Solution (1 Unified Engine)
```typescript
import express from 'express';
import { omniBody } from 'omni-body';

const app = express();
app.use(omniBody({ maxBodySize: '15mb' }));

app.post('/api/drop', (req, res) => {
  // req.payloadCategory is automatically: 'json' | 'multipart' | 'urlencoded' | 'text' | 'raw'
  const { payloadCategory, body, files, rawMimeType, rawSize } = req;
  res.json({ category: payloadCategory, body, files });
});
```

---

## 📂 Project Structure

```
OmniDrop/
├── server.ts         # Express server with omniBody & /api/drop route
├── api/
│   └── index.ts      # Vercel Serverless Function entry (bodyParser: false)
├── public/
│   └── index.html    # Clean, simple, modern dark-mode UI
├── test-client.ts    # CLI verification test suite
├── vercel.json       # Vercel deployment rewrites
├── package.json      # Dependencies and scripts
└── tsconfig.json     # TypeScript configuration
```

---

## 📜 License
MIT © [Atharv Bind](https://github.com/atharvbind)
