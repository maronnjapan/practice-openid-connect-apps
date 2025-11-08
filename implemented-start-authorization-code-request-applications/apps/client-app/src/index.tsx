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
  const clientId = c.env.CLIENT_ID
  const redirectUri = c.env.REDIRECT_URI
  const issuerUri = c.env.ISSUER_URI
  return c.render(<a href={`${issuerUri}/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=profile email`}>Authorization Code Flowの開始</a>)
})

export default app
