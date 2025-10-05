import { env } from "cloudflare:test"
import { fetchTestApplication } from "../utils"
import { defineClientFactory, defineRedirectUriFactory, defineScopeFactory } from "../../src/generated/fabbrica"

const clientFactory = defineClientFactory()
const redirectUriFactory = defineRedirectUriFactory({ defaultData: { client: clientFactory } })
const scopeFactory = defineScopeFactory({ defaultData: { client: clientFactory } })

describe('/authorize', () => {
    describe('検証が成功した場合のテストケース', () => {
        const TEST_REDIRECT_URI = 'https://example.com/callback'
        const TEST_SCOPE = 'profile email'
        let clientId = ''
        beforeEach(async () => {
            const client = await clientFactory.create({
                RedirectUri: { create: await redirectUriFactory.build({ uri: TEST_REDIRECT_URI }) },
                Scope: { create: await scopeFactory.buildList(TEST_SCOPE.split(' ').map(s => ({ name: s }))) }
            })
            clientId = client.clientId
        })
        it('同意画面を表示するURLにリダイレクトされること', async () => {
            const res = await fetchTestApplication(`/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(TEST_REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(TEST_SCOPE)}`)
            const redirectPath = res.headers.get('location')

            expect(res.status).toEqual(302)
            expect(redirectPath).toMatch(/^\/consent\/[a-zA-Z0-9]+$/)

        })
        it('同意画面のURLの動的パスをキーにして、scopeクエリの値が保存されること', async () => {
            const res = await fetchTestApplication(`/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(TEST_REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(TEST_SCOPE)}`)
            const redirectPath = res.headers.get('location')!
            const dynamicPath = redirectPath.replace('/consent/', '')

            const result = await env.MY_KV_NAMESPACE.get(dynamicPath)

            expect(res.status).toEqual(302)
            expect(JSON.parse(result)).toEqual({
                scope: TEST_SCOPE,
                clientId: clientId,
                redirectUri: TEST_REDIRECT_URI,
                responseType: 'code'
            })
        })

    })

    describe('検証が失敗した場合のテストケース', () => {
        const TEST_REDIRECT_URI = 'https://example.com/callback'
        const TEST_SCOPE = 'profile email'
        it('クエリにclient_idが存在しない場合、エラー画面が表示されること', async () => {
            const res = await fetchTestApplication('/authorize')
            const text = await res.text()

            expect(res.status).toEqual(400)
            expect(text).toContain('invalid_request')

        })
        it('クエリにredirect_uriが存在しない場合、エラー画面が表示されること', async () => {
            const client = await clientFactory.create()
            const res = await fetchTestApplication(`/authorize?client_id=${client.clientId}`)
            const text = await res.text()

            expect(res.status).toEqual(400)
            expect(text).toContain('invalid_request')
        })
        it('client_idクエリの値と一致するクライアントが存在しない場合、エラー画面が表示されること', async () => {
            const res = await fetchTestApplication(`/authorize?client_id=not-exist-client-id&redirect_uri=${encodeURIComponent(TEST_REDIRECT_URI)}`)
            const text = await res.text()

            expect(res.status).toEqual(400)
            expect(text).toContain('unauthorized_client')
        })
        it('クライアントが許可しているredirect_uriと一致しない場合、エラー画面が表示されること', async () => {
            const client = await clientFactory.create()
            const res = await fetchTestApplication(`/authorize?client_id=${client.clientId}&redirect_uri=http://example.com/invalid`)

            const text = await res.text()

            expect(res.status).toEqual(400)
            expect(text).toContain('invalid_request')
        })
        it('response_typeクエリの値がcodeでない場合、エラークエリを付与してredirect_uriクエリの値にリダイレクトされること', async () => {
            const client = await clientFactory.create({
                RedirectUri: { create: await redirectUriFactory.build({ uri: TEST_REDIRECT_URI }) }
            })
            const res = await fetchTestApplication(`/authorize?client_id=${client.clientId}&redirect_uri=${encodeURIComponent(TEST_REDIRECT_URI)}&response_type=invalid`)
            const redirectPath = res.headers.get('location')

            expect(res.status).toEqual(302)
            expect(redirectPath).toEqual(`${TEST_REDIRECT_URI}?error=unsupported_response_type`)
        })
        it('クエリにscopeが存在しない場合、エラークエリを付与してredirect_uriクエリの値にリダイレクトされること', async () => {
            const client = await clientFactory.create({
                RedirectUri: { create: await redirectUriFactory.build({ uri: TEST_REDIRECT_URI }) }
            })
            const res = await fetchTestApplication(`/authorize?client_id=${client.clientId}&redirect_uri=${encodeURIComponent(TEST_REDIRECT_URI)}&response_type=code`)
            const redirectPath = res.headers.get('location')

            expect(res.status).toEqual(302)
            expect(redirectPath).toEqual(`${TEST_REDIRECT_URI}?error=invalid_request`)
        })
        it('scopeクエリの値が、保存しているクライアントが許可しているScopeと一致しない場合、エラークエリを付与してredirect_uriクエリの値にリダイレクトされること', async () => {
            const client = await clientFactory.create({
                RedirectUri: { create: await redirectUriFactory.build({ uri: TEST_REDIRECT_URI }) },
                Scope: { create: await scopeFactory.buildList(TEST_SCOPE.split(' ').map(s => ({ name: s }))) }
            })
            const res = await fetchTestApplication(`/authorize?client_id=${client.clientId}&redirect_uri=${encodeURIComponent(TEST_REDIRECT_URI)}&response_type=code&scope=invalid`)
            const redirectPath = res.headers.get('location')

            expect(res.status).toEqual(302)
            expect(redirectPath).toEqual(`${TEST_REDIRECT_URI}?error=invalid_scope`)
        })
    })
})