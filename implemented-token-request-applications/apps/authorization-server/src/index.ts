import { Hono } from 'hono'
import { prismaMiddleware } from './middlewares/setup-prisma.middleware'
import { setUpAuthorizeRoute } from './authorize/router'
import { setUpConsentRoute } from './consent/router'
import { setUpTokenRoute } from './token/router'

export type Bindings = {
  DB: D1Database
  MY_KV_NAMESPACE: KVNamespace
  PRIVATE_KEY: string
  PUBLIC_KEY: string
}
const app = new Hono<{ Bindings: Bindings }>()

app.use('*', prismaMiddleware)

setUpAuthorizeRoute(app)
setUpConsentRoute(app)
setUpTokenRoute(app)

export default app
