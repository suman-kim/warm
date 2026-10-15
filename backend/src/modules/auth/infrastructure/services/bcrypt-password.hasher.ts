import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { PasswordHasher } from '../../application/ports/password-hasher.port.js';

const SALT_ROUNDS = 10;

/** bcrypt 비밀번호 해시기. */
@Injectable()
export class BcryptPasswordHasher implements PasswordHasher {
  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, SALT_ROUNDS);
  }

  matches(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
