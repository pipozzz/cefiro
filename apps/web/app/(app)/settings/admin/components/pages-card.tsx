"use client";

import { useState } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { CheckIcon } from "@heroicons/react/16/solid";
import { ArrowLeftIcon, DocumentTextIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import {
  Button,
  Card,
  Description,
  Input,
  Label,
  Spinner,
  TextArea,
  TextField,
  toast,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type PageRow = {
  id: string;
  slug: string;
  title: string;
  body: string;
  metaDescription: string | null;
  status: string;
  updatedAt: string | Date;
};

type Draft = {
  id: string | null;
  slug: string;
  title: string;
  body: string;
  metaDescription: string;
  status: "draft" | "published";
};

const EMPTY: Draft = {
  id: null,
  slug: "",
  title: "",
  body: "",
  metaDescription: "",
  status: "draft",
};

function pill(active: boolean) {
  return `rounded-full border px-3 py-1 text-sm font-medium transition ${
    active
      ? "border-transparent bg-[var(--accent)] text-white"
      : "border-border bg-content2 text-default-600 hover:bg-content3"
  }`;
}

/**
 * Admin CMS for custom pages served at root `/{slug}` (privacy, pricing, …).
 * Body is authored as Markdown for now; a WYSIWYG editor replaces the textarea
 * in a follow-up. List → edit/create → save (create/update) / delete.
 */
export default function PagesCard() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const listKey = trpc.admin.pages.list.queryKey();

  const pagesQuery = useQuery({ ...trpc.admin.pages.list.queryOptions(), retry: false });
  const [draft, setDraft] = useState<Draft | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: listKey });

  const save = useMutation({
    ...(draft?.id
      ? trpc.admin.pages.update.mutationOptions()
      : trpc.admin.pages.create.mutationOptions()),
    onSuccess: () => {
      invalidate();
      setDraft(null);
      toast.success("Page saved");
    },
    onError: (error) => showSafeErrorToast(error, "Could not save the page"),
  });

  const remove = useMutation({
    ...trpc.admin.pages.delete.mutationOptions(),
    onSuccess: () => {
      invalidate();
      setDraft(null);
      toast.success("Page deleted");
    },
    onError: (error) => showSafeErrorToast(error, "Could not delete the page"),
  });

  const handleSave = () => {
    if (!draft) return;
    const payload = {
      slug: draft.slug.trim().toLowerCase(),
      title: draft.title.trim(),
      body: draft.body,
      metaDescription: draft.metaDescription.trim() || null,
      status: draft.status,
    };

    if (draft.id) {
      save.mutate({ id: draft.id, ...payload });
    } else {
      save.mutate(payload);
    }
  };

  const startEdit = (page: PageRow) =>
    setDraft({
      id: page.id,
      slug: page.slug,
      title: page.title,
      body: page.body,
      metaDescription: page.metaDescription ?? "",
      status: page.status === "published" ? "published" : "draft",
    });

  return (
    <Card>
      <Card.Header>
        <div className="flex w-full items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <DocumentTextIcon className="h-5 w-5" />
            Pages
          </h2>
          {draft ? (
            <Button size="sm" variant="tertiary" onPress={() => setDraft(null)}>
              <ArrowLeftIcon className="h-4 w-4" />
              Back
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onPress={() => setDraft({ ...EMPTY })}>
              <PlusIcon className="h-4 w-4" />
              New page
            </Button>
          )}
        </div>
      </Card.Header>
      <Card.Content>
        <p className="text-muted mb-4 text-base">
          Custom pages served at <code>/slug</code> (e.g. privacy, pricing). Published pages are
          public; drafts are hidden. Body is Markdown.
        </p>

        {draft ? (
          <div className="flex flex-col gap-4">
            <TextField value={draft.title} onChange={(v) => setDraft({ ...draft, title: v })}>
              <Label>Title</Label>
              <Input variant="secondary" />
            </TextField>
            <TextField value={draft.slug} onChange={(v) => setDraft({ ...draft, slug: v })}>
              <Label>Slug (URL)</Label>
              <Input placeholder="pricing" variant="secondary" />
              <Description>Lowercase letters, numbers and hyphens — served at /slug.</Description>
            </TextField>
            <TextField value={draft.body} onChange={(v) => setDraft({ ...draft, body: v })}>
              <Label>Body (Markdown)</Label>
              <TextArea rows={16} variant="secondary" />
              <Description>Supports ## heading, **bold**, [link](https://…), - list.</Description>
            </TextField>
            <TextField
              value={draft.metaDescription}
              onChange={(v) => setDraft({ ...draft, metaDescription: v })}
            >
              <Label>Meta description (SEO, optional)</Label>
              <Input variant="secondary" />
            </TextField>

            <div className="flex items-center gap-2">
              <span className="text-default-500 mr-1 text-sm">Status</span>
              <button
                className={pill(draft.status === "draft")}
                type="button"
                onClick={() => setDraft({ ...draft, status: "draft" })}
              >
                Draft
              </button>
              <button
                className={pill(draft.status === "published")}
                type="button"
                onClick={() => setDraft({ ...draft, status: "published" })}
              >
                Published
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              {draft.id ? (
                <Button
                  isPending={remove.isPending}
                  variant="tertiary"
                  onPress={() => {
                    if (draft.id && confirm("Delete this page?")) {
                      remove.mutate({ id: draft.id });
                    }
                  }}
                >
                  <TrashIcon className="h-5 w-5" />
                  Delete
                </Button>
              ) : (
                <span />
              )}
              <Button
                isDisabled={!draft.title.trim() || !draft.slug.trim()}
                isPending={save.isPending}
                variant="primary"
                onPress={handleSave}
              >
                <CheckIcon className="h-5 w-5" />
                Save
              </Button>
            </div>
          </div>
        ) : pagesQuery.isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Spinner size="lg" />
          </div>
        ) : (pagesQuery.data ?? []).length === 0 ? (
          <p className="text-muted text-base">No pages yet. Create your first one.</p>
        ) : (
          <ul className="divide-border/50 divide-y">
            {(pagesQuery.data as PageRow[]).map((page) => (
              <li key={page.id}>
                <button
                  className="hover:bg-content2 flex w-full items-center justify-between gap-3 rounded-lg px-2 py-3 text-left transition"
                  type="button"
                  onClick={() => startEdit(page)}
                >
                  <span className="min-w-0">
                    <span className="text-foreground block truncate font-medium">{page.title}</span>
                    <span className="text-default-500 text-xs">/{page.slug}</span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      page.status === "published"
                        ? "bg-success/15 text-success"
                        : "bg-content3 text-default-500"
                    }`}
                  >
                    {page.status === "published" ? "Published" : "Draft"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card.Content>
    </Card>
  );
}
