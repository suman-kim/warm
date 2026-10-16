import { PhoneNumber } from './phone-number.js';

describe('전화번호', () => {
  it('하이픈을 빼고 9~11자리 국내 번호를 받는다', () => {
    expect(PhoneNumber.of('02-555-1234').value).toBe('025551234');
    expect(PhoneNumber.of('010-1234-5678').value).toBe('01012345678');
    expect(() => PhoneNumber.of('1234-5678')).toThrow('전화번호 형식');
  });

  it('계정 번호는 12자리 안심번호를 받지 않는다', () => {
    expect(() => PhoneNumber.of('0504-1234-5678')).toThrow('전화번호 형식');
  });

  it('주문 연락처는 배달앱 안심번호(050, 12자리)도 받는다', () => {
    expect(PhoneNumber.contact('0504-1234-5678').value).toBe('050412345678');
    expect(PhoneNumber.contact('050-1234-5678').value).toBe('05012345678');
    expect(PhoneNumber.contact('010-1234-5678').value).toBe('01012345678');
    expect(() => PhoneNumber.contact('0101-1234-5678')).toThrow(
      '전화번호 형식',
    );
  });
});
