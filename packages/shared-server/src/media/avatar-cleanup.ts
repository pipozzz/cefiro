import { schedulerLogger } from "@norish/shared-server/logger";
import { isAvatarFilenameForUser } from "@norish/shared/lib/helpers";

import { getObjectStore } from "./object-store";

/** Encrypted-user avatars live under the `avatars/` key prefix in the store. */
const AVATARS_PREFIX = "avatars";

/**
 * Delete every avatar file belonging to a user except the given filenames.
 * ADR-0021: after an upload the kept set is the new file plus its immediate
 * predecessor; a delete keeps nothing.
 */
export async function sweepUserAvatars(
  userId: string,
  keep: readonly string[] = []
): Promise<void> {
  const store = getObjectStore();
  const keys = await store.list(AVATARS_PREFIX);

  const sweepable = keys
    .map((key) => key.slice(key.lastIndexOf("/") + 1))
    .filter((file) => isAvatarFilenameForUser(file, userId) && !keep.includes(file));

  for (const file of sweepable) {
    await deleteAvatarByFilename(file);
  }
}

export async function deleteAvatarByFilename(filename: string | null | undefined): Promise<void> {
  if (!filename) {
    return;
  }

  try {
    await getObjectStore().delete(`${AVATARS_PREFIX}/${filename}`);
    schedulerLogger.info({ filename }, "Deleted avatar");
  } catch (err) {
    schedulerLogger.warn({ err, filename }, "Could not delete avatar");
  }
}
