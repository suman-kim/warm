import { parseFirebaseServiceAccount } from './firebase.config.js';

const encode = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString('base64');

const ACCOUNT = {
  type: 'service_account',
  project_id: 'movo',
  client_email: 'firebase-adminsdk@movo.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n',
};

describe('parseFirebaseServiceAccount', () => {
  it('값이 없으면 null — 푸시가 꺼진다', () => {
    expect(parseFirebaseServiceAccount(undefined)).toBeNull();
    expect(parseFirebaseServiceAccount('  ')).toBeNull();
  });

  it('base64로 인코딩한 서비스 계정 JSON에서 발송에 쓰는 값을 꺼낸다', () => {
    expect(parseFirebaseServiceAccount(encode(ACCOUNT))).toEqual({
      projectId: 'movo',
      clientEmail: 'firebase-adminsdk@movo.iam.gserviceaccount.com',
      privateKey: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----',
    });
  });

  it('해석할 수 없으면 던진다 — 조용히 꺼지지 않는다', () => {
    expect(() => parseFirebaseServiceAccount('not-base64-json')).toThrow(
      /해석할 수 없어요/,
    );
    expect(() => parseFirebaseServiceAccount(encode('text'))).toThrow(
      /해석할 수 없어요/,
    );
  });

  it('빠진 항목이 있으면 무엇이 없는지 알려주고, 값은 메시지에 싣지 않는다', () => {
    const { private_key: _omitted, ...withoutKey } = ACCOUNT;
    const act = () =>
      parseFirebaseServiceAccount(encode({ ...withoutKey, client_email: '' }));

    expect(act).toThrow(/client_email, private_key 항목이 없어요/);
    expect(act).not.toThrow(/movo/);
  });
});
