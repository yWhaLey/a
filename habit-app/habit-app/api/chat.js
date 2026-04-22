// api/chat.js — Vercelのサーバーレス関数
// APIキーはサーバー側だけで管理。ユーザーには絶対見えない。

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*'; // 本番では自分のドメインを設定

// レート制限用（簡易版 - 本番ではRedisなどを使う）
const rateLimitMap = new Map();
const RATE_LIMIT = 20;      // 1時間あたりの最大リクエスト数
const RATE_WINDOW = 60 * 60 * 1000; // 1時間（ミリ秒）

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip) || { count: 0, resetAt: now + RATE_WINDOW };

  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + RATE_WINDOW;
  }

  record.count++;
  rateLimitMap.set(ip, record);

  return record.count <= RATE_LIMIT;
}

export default async function handler(req, res) {
  // CORSヘッダー設定
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // OPTIONSリクエスト（プリフライト）への対応
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // POSTのみ受け付ける
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // レート制限チェック
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'リクエストが多すぎます。しばらく待ってからお試しください。' });
  }

  // リクエストのバリデーション
  const { messages, userContext } = req.body || {};

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid request format' });
  }

  // メッセージ数の制限（コスト管理）
  if (messages.length > 40) {
    return res.status(400).json({ error: 'メッセージが長すぎます。会話をリセットしてください。' });
  }

  // 各メッセージの長さ制限
  for (const msg of messages) {
    if (!msg.role || !msg.content || typeof msg.content !== 'string') {
      return res.status(400).json({ error: 'Invalid message format' });
    }
    if (msg.content.length > 2000) {
      return res.status(400).json({ error: 'メッセージが長すぎます。' });
    }
  }

  // APIキーの確認
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set');
    return res.status(500).json({ error: 'サーバーの設定エラーです。' });
  }

  // システムプロンプト（サーバー側で管理 - 改ざん不可）
  const systemPrompt = `あなたは習慣化の専門AIコーチです。以下の原則で回答してください：

1. ユーザーの実際のデータを必ず参照してパーソナライズされたアドバイスをする
2. 習慣化の科学的研究に基づいて答える
   - James Clearの「Atomic Habits」（習慣ループ、2分ルール、アイデンティティベースの習慣）
   - BJ Foggの「Tiny Habits」（アンカー習慣、祝福の儀式）
   - 自己決定理論（内発的動機）
   - 実行意図（if-thenプランニング）
   - 進捗原理（Teresa Amabile）
3. 抽象的なアドバイスではなく、ユーザーの具体的な習慣名や数字を使って話す
4. 日本語で、親しみやすく、でも科学的に正確に
5. 回答は300文字程度にまとめる
6. 有害・不適切なコンテンツには応答しない

${userContext ? `【ユーザーの習慣データ】\n${userContext}` : ''}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,   // ← サーバー側でのみ使用
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        system: systemPrompt,
        messages: messages,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error('Anthropic API error:', response.status, errData);
      return res.status(502).json({ error: 'AIサービスへの接続に失敗しました。' });
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text;

    if (!reply) {
      return res.status(502).json({ error: '返答の生成に失敗しました。' });
    }

    // 必要最小限のデータだけ返す
    return res.status(200).json({ reply });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました。' });
  }
}
