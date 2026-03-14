// functions/api/calendar.js
// Google Calendar API連携 - サービスアカウント認証でイベント取得

export async function onRequestGet(context) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const { env } = context;

    // 環境変数から認証情報を取得
    const clientEmail = env.GOOGLE_CLIENT_EMAIL;
    const privateKey = env.GOOGLE_PRIVATE_KEY;
    const calendarId = env.GOOGLE_CALENDAR_ID;

    if (!clientEmail || !privateKey || !calendarId) {
      return new Response(JSON.stringify({
        error: '環境変数が設定されていません',
        detail: 'GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_CALENDAR_ID を設定してください'
      }), { status: 500, headers });
    }

    // 1. JWT トークンを作成
    const token = await getAccessToken(clientEmail, privateKey);

    // 2. Google Calendar APIでイベント取得（今日〜7日後）
    const now = new Date();
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const params = new URLSearchParams({
      timeMin: now.toISOString(),
      timeMax: weekLater.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '50',
    });

    const calUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;

    const calRes = await fetch(calUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!calRes.ok) {
      const errBody = await calRes.text();
      return new Response(JSON.stringify({
        error: 'Google Calendar API エラー',
        status: calRes.status,
        detail: errBody,
      }), { status: 502, headers });
    }

    const calData = await calRes.json();

    // 3. アプリ用にデータを整形
    const bookings = (calData.items || []).map(event => ({
      id: event.id,
      calendarTitle: event.summary || '（タイトルなし）',
      displayName: event.summary || '（タイトルなし）',
      startTime: event.start?.dateTime || event.start?.date || '',
      endTime: event.end?.dateTime || event.end?.date || '',
      guestCount: event.attendees?.length || 0,
      description: event.description || '',
      location: event.location || '',
    }));

    return new Response(JSON.stringify({
      success: true,
      count: bookings.length,
      bookings,
    }), { status: 200, headers });

  } catch (err) {
    return new Response(JSON.stringify({
      error: '内部エラー',
      detail: err.message,
    }), { status: 500, headers });
  }
}

// ---- JWT認証 ----

async function getAccessToken(clientEmail, privateKeyPem) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/calendar.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  // JWT署名
  const encoder = new TextEncoder();
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await importPrivateKey(privateKeyPem);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    encoder.encode(signingInput)
  );

  const signatureB64 = base64url(signature);
  const jwt = `${signingInput}.${signatureB64}`;

  // アクセストークンと交換
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`トークン取得エラー: ${tokenRes.status} ${errText}`);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

async function importPrivateKey(pemStr) {
  // PEMからDER形式に変換
  const pem = pemStr
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');

  const binaryStr = atob(pem);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  return crypto.subtle.importKey(
    'pkcs8',
    bytes.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

function base64url(input) {
  let str;
  if (typeof input === 'string') {
    str = btoa(input);
  } else {
    // ArrayBuffer
    const bytes = new Uint8Array(input);
    let binary = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    str = btoa(binary);
  }
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
