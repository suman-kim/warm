import { PageRequest } from '../domain/pagination.js';

/** 목록 유스케이스의 페이지 입력. page는 1부터 센다. */
export interface PageQuery {
  page: number;
  size: number;
}

export function toPageRequest(query: PageQuery): PageRequest {
  return { offset: (query.page - 1) * query.size, limit: query.size };
}
