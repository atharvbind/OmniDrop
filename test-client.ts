/**
 * OmniDrop Automated CLI Verification Test Suite
 * Programmatically sends all 5 supported payload categories to POST /api/drop,
 * tests malformed JSON error handling (400 Bad Request),
 * and verifies the in-memory feed store (GET /api/feed).
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

// Minimal 1x1 transparent PNG binary buffer
const SAMPLE_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
);

// Minimal 44-byte valid WAV audio buffer (silence)
const SAMPLE_WAV_BUFFER = Buffer.from(
  '524946462400000057415645666d7420100000000100010044ac000088580100020010006461746100000000',
  'hex'
);

interface TestResult {
  name: string;
  passed: boolean;
  status: number;
  category?: string;
  detail: string;
}

const results: TestResult[] = [];

function logSection(title: string) {
  console.log(`\n\x1b[1m\x1b[36m=== ${title} ===\x1b[0m`);
}

function logPass(name: string, detail: string) {
  console.log(`  \x1b[32m✔ PASS\x1b[0m \x1b[1m${name}\x1b[0m — ${detail}`);
  results.push({ name, passed: true, status: 200, detail });
}

function logFail(name: string, detail: string, status = 500) {
  console.error(`  \x1b[31m✖ FAIL\x1b[0m \x1b[1m${name}\x1b[0m — ${detail}`);
  results.push({ name, passed: false, status, detail });
}

async function runTests() {
  console.log(`
  💧 \x1b[1m\x1b[35mOmniDrop Test Suite\x1b[0m — Testing omni-body universal ingestion
  Target server: \x1b[4m${BASE_URL}\x1b[0m
  `);

  // Verify server is reachable
  try {
    const health = await fetch(`${BASE_URL}/api/info`);
    if (!health.ok) throw new Error(`HTTP ${health.status}`);
    const info = (await health.json()) as any;
    console.log(`  Connected to \x1b[32m${info.app}\x1b[0m running \x1b[33m${info.engine}\x1b[0m on port ${info.port}`);
  } catch (err: any) {
    console.error(`\x1b[31mError connecting to ${BASE_URL}:\x1b[0m ${err.message}`);
    console.error(`Make sure the server is running with 'npm start' before running this test script.`);
    process.exit(1);
  }

  // -------------------------------------------------------------
  // Test 1: JSON Payload
  // -------------------------------------------------------------
  logSection('Test 1: JSON Payload (application/json)');
  try {
    const jsonPayload = {
      sensorId: 'sensor-omega-9',
      location: 'Sub-level 4',
      metrics: {
        tempCelsius: 22.4,
        pressureKPa: 101.3,
        status: 'nominal',
      },
      tags: ['iot', 'telemetry', 'automated'],
    };

    const res = await fetch(`${BASE_URL}/api/drop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jsonPayload),
    });

    const data = (await res.json()) as any;
    if (res.ok && data.category === 'json' && data.body.sensorId === 'sensor-omega-9') {
      logPass(
        'JSON Payload',
        `Parsed category "${data.category}", extracted ${data.details.fieldCount} fields (${data.formattedSize})`
      );
    } else {
      logFail('JSON Payload', `Unexpected response: ${JSON.stringify(data)}`, res.status);
    }
  } catch (err: any) {
    logFail('JSON Payload', err.message);
  }

  // -------------------------------------------------------------
  // Test 2: Multipart Form Upload
  // -------------------------------------------------------------
  logSection('Test 2: Multipart Form Upload (multipart/form-data)');
  try {
    const form = new FormData();
    form.append('username', 'Dr. Elena Vance');
    form.append('project', 'Black Mesa Xen Telemetry');
    form.append('priority', 'Critical');

    // Attach sample PNG file blob
    const fileBlob = new Blob([SAMPLE_PNG_BUFFER], { type: 'image/png' });
    form.append('spectrogram', fileBlob, 'telemetry_spectrogram.png');

    const res = await fetch(`${BASE_URL}/api/drop`, {
      method: 'POST',
      body: form,
    });

    const data = (await res.json()) as any;
    const hasFile = data.files && data.files.length === 1 && data.files[0].filename === 'telemetry_spectrogram.png';
    const hasPreview = !!data.previewUrl && data.previewUrl.startsWith('data:image/png;base64,');

    if (res.ok && data.category === 'multipart' && hasFile && hasPreview) {
      logPass(
        'Multipart Upload',
        `Parsed category "${data.category}", extracted 1 file (${data.files[0].filename}) with base64 preview URL and 3 text fields`
      );
    } else {
      logFail('Multipart Upload', `Files parsed: ${JSON.stringify(data.files)}`, res.status);
    }
  } catch (err: any) {
    logFail('Multipart Upload', err.message);
  }

  // -------------------------------------------------------------
  // Test 3: URL-Encoded Form
  // -------------------------------------------------------------
  logSection('Test 3: URL-Encoded Form (application/x-www-form-urlencoded)');
  try {
    const params = new URLSearchParams();
    params.append('organization', 'Acme Quantum Labs');
    params.append('plan', 'Enterprise');
    params.append('channels', 'email');
    params.append('channels', 'slack');
    params.append('channels', 'webhook');
    params.append('comments', 'Universal parsing is flawless');

    const res = await fetch(`${BASE_URL}/api/drop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = (await res.json()) as any;
    const channels = Array.isArray(data.body.channels) ? data.body.channels : [data.body.channels];

    if (res.ok && data.category === 'urlencoded' && data.body.organization === 'Acme Quantum Labs' && channels.length === 3) {
      logPass(
        'URL-Encoded Form',
        `Parsed category "${data.category}", extracted multi-value array channels: [${channels.join(', ')}]`
      );
    } else {
      logFail('URL-Encoded Form', `Unexpected body: ${JSON.stringify(data.body)}`, res.status);
    }
  } catch (err: any) {
    logFail('URL-Encoded Form', err.message);
  }

  // -------------------------------------------------------------
  // Test 4: Plain Text / Markdown
  // -------------------------------------------------------------
  logSection('Test 4: Plain Text & Markdown (text/markdown)');
  try {
    const markdownContent = `# OmniDrop Architecture 🚀

omni-body handles:
- JSON payloads
- Multipart uploads
- URL-encoded forms
- Markdown/Text
- Raw binary media

> "Zero middleware conflicts. One universal ingestion route."`;

    const res = await fetch(`${BASE_URL}/api/drop`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
      body: markdownContent,
    });

    const data = (await res.json()) as any;
    if (res.ok && data.category === 'text' && typeof data.body === 'string' && data.details.isMarkdown) {
      logPass(
        'Markdown / Plain Text',
        `Parsed category "${data.category}", ${data.details.charCount} chars, ${data.details.lineCount} lines, detected as Markdown`
      );
    } else {
      logFail('Markdown / Plain Text', `Unexpected response: ${JSON.stringify(data)}`, res.status);
    }
  } catch (err: any) {
    logFail('Markdown / Plain Text', err.message);
  }

  // -------------------------------------------------------------
  // Test 5: Raw Binary Media Buffer (image/png)
  // -------------------------------------------------------------
  logSection('Test 5: Raw Binary Buffer (image/png)');
  try {
    const res = await fetch(`${BASE_URL}/api/drop`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/png' },
      body: SAMPLE_PNG_BUFFER,
    });

    const data = (await res.json()) as any;
    const hasPreview = !!data.previewUrl && data.previewUrl.startsWith('data:image/png;base64,');

    if (res.ok && data.category === 'raw' && data.details.rawMimeType === 'image/png' && hasPreview) {
      logPass(
        'Raw Binary Buffer',
        `Parsed category "${data.category}", mimeType "${data.details.rawMimeType}", size ${data.rawSize} bytes, generated base64 image preview`
      );
    } else {
      logFail('Raw Binary Buffer', `Unexpected response: ${JSON.stringify(data)}`, res.status);
    }
  } catch (err: any) {
    logFail('Raw Binary Buffer', err.message);
  }

  // -------------------------------------------------------------
  // Test 6: Malformed JSON (Error Handling Demonstration)
  // -------------------------------------------------------------
  logSection('Test 6: Malformed JSON (400 Bad Request Error Handling)');
  try {
    const malformedJson = '{ "name": "Broken", "missingBracket": [1, 2, 3';

    const res = await fetch(`${BASE_URL}/api/drop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: malformedJson,
    });

    const data = (await res.json()) as any;
    if (res.status === 400 && data.error === 'Bad Request') {
      logPass(
        'Malformed JSON Error Handling',
        `omni-body rejected malformed JSON with HTTP 400 Bad Request: "${data.message}"`
      );
    } else {
      logFail(
        'Malformed JSON Error Handling',
        `Expected 400 Bad Request, got HTTP ${res.status}: ${JSON.stringify(data)}`,
        res.status
      );
    }
  } catch (err: any) {
    logFail('Malformed JSON Error Handling', err.message);
  }

  // -------------------------------------------------------------
  // Test 7: Feed Store Verification (GET /api/feed)
  // -------------------------------------------------------------
  logSection('Test 7: Feed History Verification (GET /api/feed)');
  try {
    const res = await fetch(`${BASE_URL}/api/feed`);
    const data = (await res.json()) as any;

    if (res.ok && data.success && Array.isArray(data.items) && data.items.length >= 5) {
      const categoriesFound = new Set(data.items.map((it: any) => it.category));
      logPass(
        'Feed Store',
        `Retrieved ${data.count} items. Stored payload categories: ${Array.from(categoriesFound).join(', ')}`
      );
    } else {
      logFail('Feed Store', `Feed items count: ${data.items?.length}`, res.status);
    }
  } catch (err: any) {
    logFail('Feed Store', err.message);
  }

  // Summary
  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;

  console.log('\n═════════════════════════════════════════════════════════════════');
  if (passedCount === totalCount) {
    console.log(`  \x1b[32m\x1b[1mALL ${totalCount} TESTS PASSED SUCCESSFULLY! 🚀\x1b[0m`);
    console.log('  omni-body successfully ingested all 5 content categories via a SINGLE route!');
  } else {
    console.error(`  \x1b[31m\x1b[1m${totalCount - passedCount} OF ${totalCount} TESTS FAILED.\x1b[0m`);
    process.exit(1);
  }
  console.log('═════════════════════════════════════════════════════════════════\n');
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
