import { AppDataSource } from '../data-source.js';

// 가입된 회원을 최고 관리자로 올린다. 첫 운영자는 이 스크립트로만 생긴다 —
// 그다음부터는 최고 관리자가 운영자 웹에서 초대한다.
//   npm run admin:promote -- someone@example.com
const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('사용법: npm run admin:promote -- <이메일>');
  process.exit(1);
}

await AppDataSource.initialize();
try {
  const result = await AppDataSource.createQueryBuilder()
    .update('users')
    .set({ role: 'ADMIN', version: () => 'version + 1' })
    .where('email = :email', { email })
    .execute();
  if (!result.affected) {
    console.error(`가입된 회원이 아니에요: ${email}`);
    process.exitCode = 1;
  } else {
    // 이미 운영자 계정이 있으면(비활성화된 계정 포함) 최고 관리자·활성으로 되돌린다.
    await AppDataSource.query(
      `INSERT INTO admin_accounts (id, role, status, version)
       SELECT id, 'SUPER', 'ACTIVE', 1 FROM users WHERE email = $1
       ON CONFLICT (id) DO UPDATE
         SET role = 'SUPER', status = 'ACTIVE', invitation_token_hash = NULL,
             invitation_expires_at = NULL, version = admin_accounts.version + 1`,
      [email],
    );
    console.log(`운영자로 올렸어요: ${email}`);
  }
} finally {
  await AppDataSource.destroy();
}
