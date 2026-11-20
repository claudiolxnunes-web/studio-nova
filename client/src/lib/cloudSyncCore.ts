import type { Project } from "@shared/editor";

export type SyncAction = "upload" | "download" | "skip";

export interface CloudProjectLike {
  id: string;
  name: string;
  data?: Partial<Project> | null;
}

/**
 * Decides which side wins when the same project exists locally and in the
 * cloud. A one-second tolerance avoids a ping-pong sync when the two clocks
 * differ by a few milliseconds.
 */
export function chooseSyncAction(
  local: Pick<Project, "updatedAt"> | undefined,
  cloud: CloudProjectLike | undefined,
): SyncAction {
  if (!local && cloud) return "download";
  if (local && !cloud) return "upload";
  if (!local || !cloud) return "skip";

  const localTime = Number(local.updatedAt) || 0;
  const cloudTime = Number(cloud.data?.updatedAt) || 0;

  if (localTime > cloudTime + 1000) return "upload";
  if (cloudTime > localTime + 1000) return "download";
  return "skip";
}
