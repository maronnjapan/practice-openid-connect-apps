import { Hono } from 'hono'
import { renderer } from './renderer'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'

export type Bindings = {
  MY_KV_NAMESPACE: KVNamespace
  CLIENT_ID: string
  CLIENT_SECRET: string
  REDIRECT_URI: string
  ISSUER_URI: string
}
const app = new Hono<{ Bindings: Bindings }>()

app.use(renderer)

app.get('/', async (c) => {
  return c.render(<a href='/start-authorize'>Authorization Code Flowの開始</a>)
})

app.get('/start-authorize', async (c) => {
  const clientId = c.env.CLIENT_ID
  const redirectUri = c.env.REDIRECT_URI
  const issuerUri = c.env.ISSUER_URI
  const state = crypto.randomUUID().replaceAll('-', '')
  setCookie(c, 'oauth_state', state, {
    httpOnly: true,
    sameSite: 'Lax',
    maxAge: 600, // 10分
    path: '/'
  })

  // 64文字（>43文字 && <128文字)のランダムな16進数文字列作成 
  const codeVerifier = [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, '0')).join('');
  // stateと同様アクセストークンリクエスト時に取り出せるようにcookieに保存
  setCookie(c, 'code_verifier', codeVerifier, {
    httpOnly: true,
    sameSite: 'Lax',
    maxAge: 600, // 10分
    path: '/'
  })

  // SHA-256でハッシュ後、base64Url形式にエンコード
  const codeChallenge = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier))
  const base64CodeChallenge = btoa(String.fromCharCode(...new Uint8Array(codeChallenge))).replaceAll('=', '').replaceAll('+', '-').replaceAll('/', '_')

  // クエリにcode_challengeと変換ロジックを示すcode_challenge_methodを付与する
  return c.redirect(`${issuerUri}/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=profile email&state=${state}&code_challenge=${base64CodeChallenge}&code_challenge_method=S256`)
})
app.get('/callback', async (c) => {
  const code = c.req.query('code')
  if (!code) {
    return c.html(<div>認可コードが存在しません</div>)
  }
  const state = c.req.query('state')
  const cookieState = getCookie(c, 'oauth_state')
  if (!state || !cookieState || state !== cookieState) {
    return c.html(<div>stateの検証に失敗しました</div>)
  }
  // 使用済みstateを削除
  deleteCookie(c, 'oauth_state')
  const codeVerifier = getCookie(c, 'code_verifier')
  if (codeVerifier) {
    // 使用済みcode_verifierを削除
    deleteCookie(c, 'code_verifier')
  }


  // トークンエンドポイントを呼び出し、アクセストークンを取得
  const requestHeader = `Basic ${btoa(`${c.env.CLIENT_ID}:${c.env.CLIENT_SECRET}`)}`
  const body = new URLSearchParams()
  body.set('grant_type', 'authorization_code')
  body.set('code', code)
  body.set('redirect_uri', c.env.REDIRECT_URI)
  if (codeVerifier) {
    body.set('code_verifier', codeVerifier)
  }

  const tokenRes = await fetch(`${c.env.ISSUER_URI}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': requestHeader
    },
    body: body.toString()
  })
  if (!tokenRes.ok) {
    return c.html(<div>トークンエンドポイントの呼び出しに失敗しました</div>)
  }
  const tokenJson = await tokenRes.json()
  return c.html(
    <div>
      <h1>アクセストークンを取得しました</h1>
      <pre>{JSON.stringify(tokenJson, null, 2)}</pre>
    </div>
  )
})

export default app
