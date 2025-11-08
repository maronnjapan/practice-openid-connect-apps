
export const AuthorizeError = ({ error, description }: { error: string, description?: string }) => {
    return (
        <div>
            <h1>Authorize Error</h1>
            <p>{error}</p>
            {description && <p>{description}</p>}
        </div>
    )
}