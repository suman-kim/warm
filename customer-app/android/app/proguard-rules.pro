# 카카오 지도 SDK는 코드 축소·난독화에서 뺀다 (릴리스 빌드에서 지도가 뜨지 않는다).
-keep class com.kakao.vectormap.** { *; }
-keep interface com.kakao.vectormap.**
