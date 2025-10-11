import { Hono } from 'hono'
import { renderer } from './renderer'

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
  await c.env.MY_KV_NAMESPACE.put(state, 'true', { expirationTtl: 600 }) // stateの有効期限は10分

  return c.redirect(`${issuerUri}/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=profile email&state=${state}`)
})
app.get('/callback', async (c) => {
  const code = c.req.query('code')
  if (!code) {
    return c.html(<div>認可コードが存在しません</div>)
  }
  const requestHeader = `Basic ${btoa(`${c.env.CLIENT_ID}:${c.env.CLIENT_SECRET}`)}`
  const body = new URLSearchParams()
  body.set('grant_type', 'authorization_code')
  body.set('code', code)
  body.set('redirect_uri', c.env.REDIRECT_URI)

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
