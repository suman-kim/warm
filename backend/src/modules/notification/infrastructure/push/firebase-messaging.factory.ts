import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { FirebaseServiceAccount } from '../../../../config/firebase.config.js';
import { FcmMessaging } from './fcm-push.sender.js';

/** 이 서버가 쓰는 Firebase 앱 이름. 기본 앱과 섞이지 않게 따로 둔다. */
const APP_NAME = 'movo-push';

/**
 * 서비스 계정으로 FCM 발송 클라이언트를 만든다.
 * 같은 프로세스에서 두 번 불려도(테스트·핫 리로드) 앱을 다시 만들지 않는다.
 */
export function createFcmMessaging(
  account: FirebaseServiceAccount,
): FcmMessaging {
  const app =
    getApps().find((each) => each.name === APP_NAME) ??
    initializeApp({ credential: cert(account) }, APP_NAME);
  return getMessaging(app);
}
