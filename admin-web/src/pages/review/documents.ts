import { useQuery } from "@tanstack/react-query";
import { reviewApi } from "../../api/admin";
import type { DriverDocument } from "../../api/types";
import type { ChipKind } from "../../ui/chip";
import { fileKind, fileSize } from "../../ui/format";
import { useObjectUrl } from "../../ui/hooks";

export function documentChip(document: DriverDocument): ChipKind {
  if (document.status === "REJECTED") {
    return "DOC_REJECTED";
  }
  if (document.resubmitted) {
    return "DOC_RESUBMITTED";
  }
  if (document.status === "APPROVED") {
    return "DOC_APPROVED";
  }
  return document.status === "SUBMITTED" ? "DOC_SUBMITTED" : "DOC_MISSING";
}

/** JPG · 2.1MB */
export function documentMeta(document: DriverDocument): string {
  return document.size === null
    ? "올리지 않았어요"
    : `${fileKind(document.contentType)} · ${fileSize(document.size)}`;
}

/** 기사가 올린 서류 파일. 올리지 않은 서류는 받지 않는다. */
export function useDocumentFile(driverId: string, document: DriverDocument) {
  const file = useQuery({
    queryKey: ["review", "file", driverId, document.type, document.uploadedAt],
    queryFn: () => reviewApi.documentFile(driverId, document.type),
    enabled: document.status !== "NOT_SUBMITTED",
    staleTime: Infinity,
  });
  return {
    blob: file.data,
    url: useObjectUrl(file.data),
    isImage: document.contentType?.startsWith("image/") ?? false,
  };
}
