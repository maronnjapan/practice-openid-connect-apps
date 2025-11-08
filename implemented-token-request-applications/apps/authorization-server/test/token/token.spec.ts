import { env } from "cloudflare:test"
import { AuthorizeRequestValue } from "../../src/authorize/types"
import { defineClientFactory } from "../../src/generated/fabbrica"
import { fetchTestApplication } from "../utils"

const clientFactory = defineClientFactory()
describe('/token', () => {
    it('リクエストが適切な場合,アクセストークンが発行され、認可コードをキーにしたAuthorizeリクエスト時の情報がKVから削除されること', async () => {
        const client = await clientFactory.create()
        const storedValue: AuthorizeRequestValue = {
            clientId: client.clientId,
            redirectUri: 'https://example.com/callback',
            scope: 'profile email',
            responseType: 'code',
        }
        const code = 'test-code'
        await env.MY_KV_NAMESPACE.put(code, JSON.stringify(storedValue))
        const requestHeader = `Basic ${btoa(`${client.clientId}:${client.clientSecret}`)}`
        const body = new URLSearchParams()
        body.set('grant_type', 'authorization_code')
        body.set('code', code)
        body.set('redirect_uri', storedValue.redirectUri)

        const tokenRes = await fetchTestApplication('/token', {
            method: 'POST',
            headers: {
                'Authorization': requestHeader,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
        })

        const kvValueRelatedCode = await env.MY_KV_NAMESPACE.get(code)

        expect(tokenRes.status).toEqual(200)
        const tokenJson = await tokenRes.json()
        expect(tokenJson).toHaveProperty('access_token')
        expect(tokenJson).toHaveProperty('token_type', 'Bearer')
        expect(tokenJson).toHaveProperty('expires_in', 3600)
        expect(tokenJson).toHaveProperty('scope', storedValue.scope)
        expect(kvValueRelatedCode).toBeNull()
    })
    it('クライアントIDに一致するクライアントが存在しない場合、エラーとすること', async () => {
        const requestHeader = `Basic ${btoa(`invalid-client-id:invalid-client-secret`)}`
        const body = new URLSearchParams()
        body.set('grant_type', 'authorization_code')
        body.set('code', 'some-code')
        body.set('redirect_uri', 'https://example.com/callback')

        const tokenRes = await fetchTestApplication('/token', {
            method: 'POST',
            headers: {
                'Authorization': requestHeader,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
        })
        expect(tokenRes.status).toEqual(401)
        const tokenJson = await tokenRes.json()
        expect(tokenJson).toHaveProperty('error', 'invalid_client')
    })
    it('クライアントシークレットが不正な場合、エラーとすること', async () => {
        const client = await clientFactory.create()
        const requestHeader = `Basic ${btoa(`${client.clientId}:invalid-client-secret`)}`
        const body = new URLSearchParams()
        body.set('grant_type', 'authorization_code')
        body.set('code', 'some-code')
        body.set('redirect_uri', 'https://example.com/callback')

        const tokenRes = await fetchTestApplication('/token', {
            method: 'POST',
            headers: {
                'Authorization': requestHeader,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
        })

        expect(tokenRes.status).toEqual(401)
        const tokenJson = await tokenRes.json()
        expect(tokenJson).toHaveProperty('error', 'invalid_client')
    })
    it('認可コードに紐づく情報が存在しない場合、エラーとすること', async () => {
        const client = await clientFactory.create()
        const requestHeader = `Basic ${btoa(`${client.clientId}:${client.clientSecret}`)}`
        const body = new URLSearchParams()
        body.set('grant_type', 'authorization_code')
        body.set('code', 'non-existent-code')
        body.set('redirect_uri', 'https://example.com/callback')

        const tokenRes = await fetchTestApplication('/token', {
            method: 'POST',
            headers: {
                'Authorization': requestHeader,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
        })

        expect(tokenRes.status).toEqual(400)
        const tokenJson = await tokenRes.json()
        expect(tokenJson).toHaveProperty('error', 'invalid_code')
    })
    it('リダイレクトURIがAuthorizeリクエスト時の値と異なる場合、エラーとすること', async () => {
        const client = await clientFactory.create()
        const requestHeader = `Basic ${btoa(`${client.clientId}:${client.clientSecret}`)}`
        const storedValue: AuthorizeRequestValue = {
            clientId: client.clientId,
            redirectUri: 'https://example.com/callback',
            scope: 'profile email',
            responseType: 'code',
        }
        const code = 'test-code-for-invalid-redirect-uri'
        await env.MY_KV_NAMESPACE.put(code, JSON.stringify(storedValue))
        const body = new URLSearchParams()
        body.set('grant_type', 'authorization_code')
        body.set('code', code)
        body.set('redirect_uri', 'https://example.com/invalid-callback')

        const tokenRes = await fetchTestApplication('/token', {
            method: 'POST',
            headers: {
                'Authorization': requestHeader,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
        })

        expect(tokenRes.status).toEqual(400)
        const tokenJson = await tokenRes.json()
        expect(tokenJson).toHaveProperty('error', 'invalid_uri')
    })
    it('grant_typeがauthorization_codeでない場合、エラーとすること', async () => {
        const client = await clientFactory.create()
        const requestHeader = `Basic ${btoa(`${client.clientId}:${client.clientSecret}`)}`
        const storedValue: AuthorizeRequestValue = {
            clientId: client.clientId,
            redirectUri: 'https://example.com/callback',
            scope: 'profile email',
            responseType: 'code',
        }
        const code = 'test-code-for-invalid-redirect-uri'
        await env.MY_KV_NAMESPACE.put(code, JSON.stringify(storedValue))
        const body = new URLSearchParams()
        body.set('grant_type', 'invalid-grant-type')
        body.set('code', code)
        body.set('redirect_uri', storedValue.redirectUri)

        const tokenRes = await fetchTestApplication('/token', {
            method: 'POST',
            headers: {
                'Authorization': requestHeader,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
        })

        expect(tokenRes.status).toEqual(400)
        const tokenJson = await tokenRes.json()
        expect(tokenJson).toHaveProperty('error', 'unsupported_grant_type')
    })
})