export interface AuthorizeRequestValue {
    scope: string
    clientId: string
    redirectUri: string
    responseType: 'code'
    state?: string
}