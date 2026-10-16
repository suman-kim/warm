import 'dart:typed_data';

import '../json.dart';

/// 가입할 때 받는 약관 동의. 필수 항목에 동의하지 않으면 서버가 가입을 거절한다.
class Agreements {
  const Agreements({
    required this.terms,
    required this.privacy,
    this.marketing = false,
  });

  /// [필수] 이용약관
  final bool terms;

  /// [필수] 개인정보 수집·이용
  final bool privacy;

  /// [선택] 마케팅 정보 수신. 나중에 `users.update`로 바꿀 수 있다.
  final bool marketing;

  Json toJson() => {'terms': terms, 'privacy': privacy, 'marketing': marketing};
}

/// 서버에 올릴 파일 (라이더 서류). 사진(JPG·PNG·WEBP·HEIC)이나 PDF, 10MB까지.
/// 형식은 서버가 파일 내용으로 판단한다.
class UploadFile {
  const UploadFile({required this.bytes, required this.filename});

  final Uint8List bytes;
  final String filename;
}

/// 서버에서 받은 파일.
class FileContent {
  const FileContent({required this.bytes, required this.contentType});

  final Uint8List bytes;

  /// 예: image/jpeg, application/pdf
  final String contentType;
}
