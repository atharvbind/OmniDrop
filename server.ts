import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { omniBody, formatBytes, OmniFile } from 'omni-body';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// ==========================================
// 1. Mount omniBody Middleware Globally
// ==========================================
// omni-body replaces body-parser, multer, raw-body, and qs in a single middleware.
// It detects and parses JSON, Multipart Form, URL-Encoded, Text/Markdown, and Raw Binary.
app.use(
  omniBody({
    maxBodySize: '15mb',
    handleErrors: true, // Automatically returns clean 400 Bad Request or 413 Payload Too Large
  })
);

// Serve static frontend from public/
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// In-Memory Feed Store (Last 50 Drops)
// ==========================================
export interface DropItem {
  id: string;
  timestamp: string;
  category: 'json' | 'multipart' | 'text' | 'raw' | 'urlencoded' | 'none';
  contentType: string;
  summary: string;
  details: Record<string, any>;
  previewUrl: string | null;
  rawSize: number;
  formattedSize: string;
  body: any;
  files: Array<{
    fieldname: string;
    filename: string;
    mimetype: string;
    size: number;
    previewUrl?: string;
  }>;
}

const MAX_FEED_ITEMS = 50;
const feed: DropItem[] = [];

// ==========================================
// 2. The Universal Ingestion Endpoint
// ==========================================
app.post('/api/drop', (req: Request, res: Response) => {
  const category = (req.payloadCategory || 'none') as DropItem['category'];
  const rawContentType = req.headers['content-type'] || 'unknown';
  const id = `drop_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const timestamp = new Date().toISOString();

  let summary = '';
  let details: Record<string, any> = {};
  let previewUrl: string | null = null;
  let rawSize = 0;
  let responseBody: any = req.body;
  let files: DropItem['files'] = [];

  const contentLengthHeader = req.headers['content-length'];
  const reportedLength = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;

  switch (category) {
    case 'json': {
      const isArr = Array.isArray(req.body);
      const keyCount = isArr ? req.body.length : Object.keys(req.body || {}).length;
      summary = isArr
        ? `JSON Array (${keyCount} items)`
        : `JSON Object (${keyCount} fields)`;

      details = {
        isArray: isArr,
        fieldCount: keyCount,
        keys: isArr ? [] : Object.keys(req.body || {}).slice(0, 10),
      };

      rawSize = reportedLength || Buffer.byteLength(JSON.stringify(req.body || {}), 'utf8');
      responseBody = req.body;
      break;
    }

    case 'multipart': {
      const rawFiles: OmniFile[] = Array.isArray(req.files) ? req.files : [];
      let totalFilesSize = 0;

      files = rawFiles.map((file) => {
        totalFilesSize += file.size;
        const isImage = file.mimetype.startsWith('image/');
        const isAudio = file.mimetype.startsWith('audio/');
        const filePreview = (isImage || isAudio) && file.buffer
          ? `data:${file.mimetype};base64,${file.buffer.toString('base64')}`
          : undefined;

        return {
          fieldname: file.fieldname,
          filename: file.filename,
          mimetype: file.mimetype,
          size: file.size,
          previewUrl: filePreview,
        };
      });

      // Select first previewable file for card cover
      const firstPreview = files.find((f) => f.previewUrl);
      if (firstPreview?.previewUrl) {
        previewUrl = firstPreview.previewUrl;
      }

      const fieldKeys = Object.keys(req.body || {});
      summary = files.length > 0 
        ? `${files.length} file(s) uploaded` 
        : `Multipart form with ${fieldKeys.length} fields`;

      details = {
        fileCount: files.length,
        fieldCount: fieldKeys.length,
        filenames: files.map((f) => f.filename),
        fields: fieldKeys,
      };

      rawSize = reportedLength || totalFilesSize;
      responseBody = req.body;
      break;
    }

    case 'urlencoded': {
      const formKeys = Object.keys(req.body || {});
      summary = `Form submission (${formKeys.length} fields)`;

      details = {
        fieldCount: formKeys.length,
        fields: formKeys,
      };

      rawSize = reportedLength || Buffer.byteLength(new URLSearchParams(req.body as any).toString(), 'utf8');
      responseBody = req.body;
      break;
    }

    case 'text': {
      const textContent = typeof req.body === 'string' ? req.body : String(req.body || '');
      const charCount = textContent.length;
      const lines = textContent.split('\n').length;
      const words = textContent.trim().split(/\s+/).filter(Boolean).length;

      summary = `Plain Text / Markdown (${charCount} characters)`;

      details = {
        charCount,
        lineCount: lines,
        wordCount: words,
        isMarkdown: textContent.includes('#') || textContent.includes('```') || textContent.includes('*'),
      };

      rawSize = reportedLength || Buffer.byteLength(textContent, 'utf8');
      responseBody = textContent;
      break;
    }

    case 'raw': {
      const buffer = Buffer.isBuffer(req.body) ? (req.body as Buffer) : Buffer.from(req.body || '');
      const mime = req.rawMimeType || 'application/octet-stream';
      rawSize = req.rawSize || buffer.length || reportedLength;

      const isImage = mime.startsWith('image/');
      const isAudio = mime.startsWith('audio/');

      if ((isImage || isAudio) && buffer.length > 0) {
        previewUrl = `data:${mime};base64,${buffer.toString('base64')}`;
      }

      summary = `Raw Binary Buffer (${formatBytes(rawSize)})`;

      details = {
        rawMimeType: mime,
        byteLength: rawSize,
        hexPreview: buffer.subarray(0, 24).toString('hex') + (buffer.length > 24 ? '...' : ''),
      };

      responseBody = {
        type: 'Buffer',
        size: rawSize,
        mimeType: mime,
        hexSample: details.hexPreview,
      };
      break;
    }

    default: {
      summary = `Ingested ${category}`;
      details = { category };
      rawSize = reportedLength;
      responseBody = req.body;
      break;
    }
  }

  const dropItem: DropItem = {
    id,
    timestamp,
    category,
    contentType: rawContentType,
    summary,
    details,
    previewUrl,
    rawSize,
    formattedSize: formatBytes(rawSize),
    body: responseBody,
    files,
  };

  // Prepend to in-memory feed and maintain max limit
  feed.unshift(dropItem);
  if (feed.length > MAX_FEED_ITEMS) {
    feed.pop();
  }

  res.status(200).json(dropItem);
});

// ==========================================
// 3. In-memory Feed Store API
// ==========================================
app.get('/api/feed', (_req: Request, res: Response) => {
  res.json({
    success: true,
    count: feed.length,
    items: feed,
  });
});

app.delete('/api/feed', (_req: Request, res: Response) => {
  feed.length = 0;
  res.json({
    success: true,
    message: 'Feed cleared successfully',
    count: 0,
  });
});

// Server info / health check
app.get('/api/info', (_req: Request, res: Response) => {
  res.json({
    status: 'online',
    app: 'OmniDrop',
    engine: 'omni-body@1.0.0',
    port: PORT,
    feedCount: feed.length,
    uptime: Math.round(process.uptime()),
    features: ['json', 'multipart', 'urlencoded', 'text', 'raw'],
  });
});

// Global Fallback Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[OmniDrop Error Handler]', err);
  if (!res.headersSent) {
    res.status(err.statusCode || 500).json({
      error: err.name || 'Internal Server Error',
      message: err.message || 'An unexpected error occurred',
      statusCode: err.statusCode || 500,
    });
  }
});

// Only start the HTTP listener if not running in serverless environment (e.g., Vercel)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`
  ╔═════════════════════════════════════════════════════════════════╗
  ║   💧 OmniDrop — Universal Body Parser Demo                    ║
  ║   Powered by omni-body (Single-Route Ingestion Engine)         ║
  ╠═════════════════════════════════════════════════════════════════╣
  ║   🌐 Web App:    http://localhost:${PORT}                        ║
  ║   📥 Ingest:     POST http://localhost:${PORT}/api/drop          ║
  ║   📋 Feed:       GET  http://localhost:${PORT}/api/feed          ║
  ║   📦 Middleware: omniBody({ maxBodySize: '15mb' })            ║
  ╚═════════════════════════════════════════════════════════════════╝
  Ready to accept JSON, Multipart, URL-encoded, Text, & Raw binary!
    `);
  });
}

export default app;
