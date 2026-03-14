// functions/api/auth.js
// パスワード認証API

export async function onRequestPost(context) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const { env } = context;
    const body = await context.request.json();
    const password = body.password || '';
    const correctPassword = env.APP_PASSWORD;

    if (!correctPassword) {
      return new Response(JSON.stringify({ success: true }), { status: 200, headers });
    }

    if (password === correctPassword) {
      return new Response(JSON.stringify({ success: true }), { status: 200, headers });
    } else {
      return new Response(JSON.stringify({ success: false, error: 'パスワードが違います' }), { status: 401, headers });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}
