import app from ".."
import { AuthorizeRequestValue } from "../authorize/types"

const encodeBase64Url = (input: string) => {
    return btoa(input).replace(/\/|\+/g, (m) => ({ '/': '_', '+': '-' }[m] ?? m)).replace(/=/g, '')
}

export const setUpTokenRoute = (baseApp: typeof app) => {
    baseApp.post('/token', async (c) => {
        // リクエストヘッダーのAuthorizationを取得
        const authHeader = c.req.header('Authorization') || ''
        /**
         * AuthorizationヘッダーがBasic認証でない場合、エラー
         * 厳密には、リクエストボディのclient_idとclient_secretを使った認証もサポートする必要があるが、今回は省略
         */
        if (!authHeader.startsWith('Basic ')) {
            return c.json({
                error: 'invalid_client',
                error_description: 'クライアント認証に失敗しました'
            }, 401)
        }
        // Basic認証の部分を除去し、Base64デコードしてクライアントIDとクライアントシークレットを取得
        const base64Client = authHeader.replace('Basic ', '')
        const decodedClient = atob(base64Client)
        const [clientId, clientSecret] = decodedClient.split(':')
        // クライアントIDに一致するクライアントをDBから取得
        const prisma = c.get('prisma')
        const client = await prisma.client.findUnique({
            where: { clientId },
        })
        // クライアントIDに一致するクライアントが存在しない場合、エラー
        if (!client) {
            return c.json({
                error: 'invalid_client',
                error_description: 'クライアント認証に失敗しました'
            }, 401)
        }
        // クライアントシークレットが一致しない場合、エラー
        if (client.clientSecret !== clientSecret) {
            return c.json({
                error: 'invalid_client',
                error_description: 'クライアント認証に失敗しました'
            }, 401)
        }
        // リクエストボディを取得
        const requestBody = await c.req.parseBody()
        const grantType = requestBody['grant_type']
        const code = requestBody['code']
        const redirectUri = requestBody['redirect_uri']
        // grant_typeがauthorization_codeでない場合、エラー
        if (grantType !== 'authorization_code') {
            return c.json({
                error: 'unsupported_grant_type',
                error_description: 'grant_typeが不正です'
            }, 400)
        }
        if (!code || typeof code !== 'string') {
            return c.json({
                error: 'invalid_code',
                error_description: 'codeがありません'
            }, 400)
        }
        // codeに紐づく情報をKVから取得
        const authorizeRequestValue = await c.env.MY_KV_NAMESPACE.get(code)
        // codeに紐づく情報が存在しない場合、エラー
        if (!authorizeRequestValue) {
            return c.json({
                error: 'invalid_code',
                error_description: '認可コードが不正です'
            }, 400)
        }
        const authorizeRequestJson = JSON.parse(authorizeRequestValue) as AuthorizeRequestValue
        // codeに紐づくredirect_uriとリクエストのredirect_uriが異なる場合、エラー
        if (authorizeRequestJson.redirectUri !== redirectUri) {
            return c.json({
                error: 'invalid_uri',
                error_description: 'redirect_uriが不正です'
            }, 400)
        }
        /**
         * ここまで到達した場合、検証が成功したことになるので、アクセストークンを発行する
         * アクセストークンの方式はBearerトークンとし、JWTで発行する
         * 署名にはES256を使用する
         */
        const privateKeyStr = c.env.PRIVATE_KEY;
        const encoder = new TextEncoder()

        // JWK形式の秘密鍵をCryptoKey形式に変換
        const privateKey = await crypto.subtle.importKey(
            "jwk",
            JSON.parse(privateKeyStr),
            {
                name: 'ECDSA',
                namedCurve: "P-256",
                hash: 'SHA-256'
            },
            false,
            ["sign"]
        )

        // JWT用のヘッダーとペイロードを作成
        const tokenHeader = {
            alg: 'ES256',
            typ: "JWT"
        }
        const tokenPayload = {
            exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour expiration
            iat: Math.floor(Date.now() / 1000),
            scope: authorizeRequestJson.scope
        }
        // 署名を生成
        const sign = await crypto.subtle.sign(
            {
                name: 'ECDSA',
                hash: 'SHA-256',

            },
            privateKey,
            encoder.encode(`${encodeBase64Url(JSON.stringify(tokenHeader))}.${encodeBase64Url(JSON.stringify(tokenPayload))}`)
        )

        const accessToken = `${encodeBase64Url(JSON.stringify(tokenHeader))}.${encodeBase64Url(JSON.stringify(tokenPayload))}.${encodeBase64Url(String.fromCharCode(...new Uint8Array(sign)))}`

        await c.env.MY_KV_NAMESPACE.delete(code) // 認可コードは使い捨てなので削除する

        return c.json({
            access_token: accessToken,
            token_type: 'Bearer',
            expires_in: 3600,
            scope: authorizeRequestJson.scope
        })
    })
}