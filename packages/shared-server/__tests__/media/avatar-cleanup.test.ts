// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sweepUserAvatars } from "@norish/shared-server/media/avatar-cleanup";

const storeMocks = vi.hoisted(() => ({
  list: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@norish/shared-server/media/object-store", () => ({
  getObjectStore: () => ({ list: storeMocks.list, delete: storeMocks.delete }),
}));

vi.mock("@norish/shared-server/logger", () => ({
  schedulerLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("sweepUserAvatars", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeMocks.delete.mockResolvedValue(undefined);
  });

  it("deletes all avatar files for the user when nothing is kept", async () => {
    storeMocks.list.mockResolvedValue([
      "avatars/user-1-100.png",
      "avatars/user-1-200.webp",
      "avatars/user-1.jpg",
      "avatars/user-2-100.png",
    ]);

    await sweepUserAvatars("user-1");

    const deleted = storeMocks.delete.mock.calls.map(([k]: [string]) => k);

    expect(deleted).toEqual([
      "avatars/user-1-100.png",
      "avatars/user-1-200.webp",
      "avatars/user-1.jpg",
    ]);
  });

  it("retains the kept filenames (current upload and its predecessor)", async () => {
    storeMocks.list.mockResolvedValue([
      "avatars/user-1-100.png",
      "avatars/user-1-200.png",
      "avatars/user-1-300.png",
    ]);

    await sweepUserAvatars("user-1", ["user-1-300.png", "user-1-200.png"]);

    const deleted = storeMocks.delete.mock.calls.map(([k]: [string]) => k);

    expect(deleted).toEqual(["avatars/user-1-100.png"]);
  });

  it("never touches other users' files", async () => {
    storeMocks.list.mockResolvedValue(["avatars/user-2-100.png", "avatars/user-10-100.png"]);

    await sweepUserAvatars("user-1");

    expect(storeMocks.delete).not.toHaveBeenCalled();
  });

  it("swallows a missing avatars directory", async () => {
    // An absent prefix lists as empty rather than throwing.
    storeMocks.list.mockResolvedValue([]);

    await expect(sweepUserAvatars("user-1")).resolves.toBeUndefined();
    expect(storeMocks.delete).not.toHaveBeenCalled();
  });

  it("continues past individual delete failures", async () => {
    storeMocks.list.mockResolvedValue(["avatars/user-1-100.png", "avatars/user-1-200.png"]);
    storeMocks.delete.mockRejectedValueOnce(new Error("EACCES"));

    await sweepUserAvatars("user-1");

    expect(storeMocks.delete).toHaveBeenCalledTimes(2);
  });
});
