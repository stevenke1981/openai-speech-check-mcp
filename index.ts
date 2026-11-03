import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { diffChars } from 'diff';
import { isAbsolute, extname } from 'node:path';
import { z } from 'zod';

const server = new McpServer({ name: 'openai-speech-check', version: '1.0.0' });
const reference = z.string().min(1).max(10000).describe('要核對的原稿文字');
const transcript = z.string().min(1).max(10000).describe('待比對的轉錄文字');

function compare(expected: string, actual: string) {
  const normalize = (text: string) => text.normalize('NFKC').toLocaleLowerCase().replace(/[\p{P}\p{S}\s]/gu, '');
  const a = normalize(expected);
  const b = normalize(actual);
  if (!a || !b) throw new Error('原稿與轉錄文字正規化後都必須包含文字或數字。');
  const parts = diffChars(a, b);
  const differences: { type: string; expected: string; actual: string }[] = [];
  let deleted = '', inserted = '', errors = 0;
  for (const part of [...parts, { value: '', added: false, removed: false }]) {
    if (part.removed) deleted += part.value;
    else if (part.added) inserted += part.value;
    else if (deleted || inserted) {
      differences.push({ type: deleted && inserted ? 'substitution' : deleted ? 'omission' : 'addition', expected: deleted, actual: inserted });
      errors += Math.max([...deleted].length, [...inserted].length);
      deleted = ''; inserted = '';
    }
  }
  return { reference: expected, transcript: actual, normalized_reference: a, normalized_transcript: b, exact_match_after_normalization: a === b, reference_characters: [...a].length, approximate_character_error_rate: errors / [...a].length, differences, note: '差異為轉錄與原稿的文字差異，可能來自辨識錯誤；錯誤率以差異區塊估算，可超過 1，不是發音評分，請回聽確認。忽略大小寫、標點、符號與空白；繁簡字不自動轉換。' };
}

server.registerTool('compare_transcripts', {
  description: '離線比較原稿與既有逐字稿；回傳疑似漏字、增字和替換。',
  inputSchema: { reference, transcript },
}, async ({ reference, transcript }) => ({ content: [{ type: 'text', text: JSON.stringify(compare(reference, transcript), null, 2) }] }));

server.registerTool('check_audio_against_script', {
  description: '將本機音檔上傳 OpenAI 進行付費語音轉錄，再與原稿比較。呼叫會傳送整個音檔並產生 API 費用，請先取得使用者授權。',
  inputSchema: {
    audio_path: z.string().min(1).describe('本機音檔絕對路徑；支援 mp3、mp4、mpeg、mpga、m4a、wav、webm，最大 25 MB'),
    reference,
    languages: z.array(z.string().min(2).max(12)).max(5).optional().describe('可選的語言代碼，例如 ["zh-tw"]'),
  },
}, async ({ audio_path, reference, languages }) => {
  if (!isAbsolute(audio_path)) throw new Error('audio_path 必須是本機絕對路徑。');
  if (!['.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.wav', '.webm'].includes(extname(audio_path).toLowerCase())) throw new Error('不支援的檔案格式。');
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('未設定 OPENAI_API_KEY；請依 README 設定後重啟 Agent。');
  const file = Bun.file(audio_path);
  if (!(await file.exists())) throw new Error('找不到音檔。');
  if (!file.size || file.size > 25_000_000) throw new Error('音檔必須大於 0 且不超過 25 MB。');
  const form = new FormData();
  form.append('model', 'gpt-transcribe');
  form.append('file', file, audio_path.split(/[\\/]/).pop());
  for (const language of languages ?? []) form.append('languages[]', language);
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form });
  if (!response.ok) throw new Error(`OpenAI 轉錄失敗（HTTP ${response.status}）；請檢查 API 金鑰、帳務、模型使用權限及語言代碼。未自動重試。`);
  const result = z.object({ text: z.string().min(1).max(10000), languages: z.array(z.object({ code: z.string() }).passthrough()).optional() }).parse(await response.json());
  return { content: [{ type: 'text', text: JSON.stringify({ model: 'gpt-transcribe', detected_languages: result.languages ?? [], ...compare(reference, result.text) }, null, 2) }] };
});

await server.connect(new StdioServerTransport());
