import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** 로그인 없이 부를 수 있는 라우트로 표시한다. 표시하지 않은 라우트는 모두 인증이 필요하다. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
