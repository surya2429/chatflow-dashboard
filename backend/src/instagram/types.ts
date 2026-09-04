export interface ShortLivedTokenResponse {
  access_token: string
  user_id: string
  permissions: string // comma-separated scope list, per Meta's response shape
}

export interface LongLivedTokenResponse {
  access_token: string
  token_type: 'bearer'
  expires_in: number // seconds
}

export interface InstagramProfile {
  user_id: string
  username: string
}
