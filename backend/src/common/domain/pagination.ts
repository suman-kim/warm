/** 저장소 목록 조회의 범위. */
export interface PageRequest {
  offset: number;
  limit: number;
}

/** 저장소 목록 조회 결과. total은 범위와 무관한 전체 건수. */
export interface Paged<T> {
  items: T[];
  total: number;
}
