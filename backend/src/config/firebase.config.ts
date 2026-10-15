/** Firebase 서비스 계정에서 발송에 쓰는 세 값. */
export interface FirebaseServiceAccount {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

/**
 * FIREBASE_SERVICE_ACCOUNT_BASE64를 해석한다.
 *
 * 값이 없으면 null(푸시 꺼짐), 있는데 형식이 틀리면 던진다. 조용히 꺼지면 설정했다고
 * 믿은 채로 운영에서 알림이 한 건도 나가지 않는다.
 *
 * 오류 메시지에 값을 싣지 않는다 — 비공개 키가 로그에 남는다.
 */
export function parseFirebaseServiceAccount(
  raw: string | undefined,
): FirebaseServiceAccount | null {
  const value = raw?.trim();
  if (!value) {
    return null;
  }

  let json: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(value, 'base64').toString('utf8'),
    );
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('not an object');
    }
    json = parsed as Record<string, unknown>;
  } catch {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_BASE64를 해석할 수 없어요. ' +
        'Firebase 콘솔에서 받은 서비스 계정 JSON 파일을 통째로 base64 인코딩한 값이어야 해요.',
    );
  }

  const text = (key: string) =>
    typeof json[key] === 'string' ? json[key].trim() : '';
  const account: FirebaseServiceAccount = {
    projectId: text('project_id'),
    clientEmail: text('client_email'),
    privateKey: text('private_key'),
  };
  const missing = [
    ['project_id', account.projectId],
    ['client_email', account.clientEmail],
    ['private_key', account.privateKey],
  ]
    .filter(([, found]) => !found)
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(
      `FIREBASE_SERVICE_ACCOUNT_BASE64에 ${missing.join(', ')} 항목이 없어요. ` +
        '서비스 계정 키(JSON) 파일이 맞는지 확인해 주세요.',
    );
  }
  return account;
}
