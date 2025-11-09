import { Hono } from 'hono'

const base64UrlDecode = (str: string) => {
    /**  URLで使用可能な形式にエンコードされた文字列を元のBase64で使用される文字列に置換 */
    const replaceStr = str.replace(/-/g, '+').replace(/_/g, '/');
    return atob(replaceStr);
}

type Bindings = {
    AUTHORIZATION_SERVER_ISSUER: string
}
const app = new Hono<{ Bindings: Bindings }>()

app.get('/api/resource', async (c) => {
    const accessToken = c.req.header('Authorization')?.replace('Bearer ', '')
    if (!accessToken) {
        return c.json({ error: 'Unauthorized' }, 401)
    }

    const [header, payload, signature] = accessToken.split('.')
    if (!header || !payload || !signature) {
        return c.json({ error: 'Invalid token format' }, 400)
    }

    const decodedPayload = base64UrlDecode(payload)
    const parsedPayload = JSON.parse(decodedPayload)
    const decodedHeader = base64UrlDecode(header)
    const parsedHeader = JSON.parse(decodedHeader)
    const decodedSignature = base64UrlDecode(signature)

    // JWKSエンドポイントから公開鍵を取得

    const jwksRes = await fetch(`${c.env.AUTHORIZATION_SERVER_ISSUER}/.well-known/jwks.json`)
    if (!jwksRes.ok) {
        return c.json({ error: 'Failed to fetch JWKS' }, 500)
    }
    const jwks = await jwksRes.json() as { keys: any[] }

    // トークンの検証
    const publicKeyJson = jwks.keys.find((key: any) => key.kid === parsedHeader.kid)
    if (!publicKeyJson) {
        return c.json({ error: 'Public key not found' }, 400)
    }

    const encoder = new TextEncoder()

    const publicKey = await crypto.subtle.importKey(
        'jwk',
        publicKeyJson,
        {
            name: 'ECDSA',
            namedCurve: 'P-256'
        },
        false,
        ['verify']
    )

    const signatureBuffer = Uint8Array.from(decodedSignature, c => c.charCodeAt(0))

    const isVerified = await crypto.subtle.verify(
        {
            name: 'ECDSA',
            hash: { name: 'SHA-256' }
        },
        publicKey,
        signatureBuffer,
        encoder.encode(`${header}.${payload}`)
    )

    if (!isVerified) {
        return c.json({ error: 'Invalid token signature' }, 401)
    }

    // トークンの有効期限を確認
    const currentTime = Math.floor(Date.now() / 1000)
    if (parsedPayload.exp < currentTime) {
        return c.json({ error: 'Token has expired' }, 401)
    }

    // トークンのスコープを確認
    const requiredScope = 'read:resource'
    const tokenScopes = parsedPayload.scope ? parsedPayload.scope.split(' ') : []
    if (!tokenScopes.includes(requiredScope)) {
        return c.json({ error: 'Insufficient scope' }, 403)
    }

    return c.json({ data: 'Protected resource data' })

})

export default app