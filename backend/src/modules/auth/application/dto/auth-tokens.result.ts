import { UserResult } from '../../../user/application/dto/user.result.js';

/** 가입·로그인·토큰 갱신 응답. */
export class AuthTokensResult {
  /** API 호출에 쓰는 토큰 (Authorization: Bearer) */
  accessToken: string;
  /** 액세스 토큰을 갱신할 때 쓰는 토큰. 쓸 때마다 새로 발급된다. */
  refreshToken: string;
  user: UserResult;
}
