"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, Pencil, Search, Trash2, X } from "lucide-react";
import { CadenceMark } from "@/components/CadenceMark";
import { GhostButton, Modal, PrimaryButton, inputClass } from "@/components/ui/Modal";
import {
  SNIPPET_MARK_END,
  SNIPPET_MARK_START,
  formatChatDate,
  formatTokens,
  type ChatMeta,
  type ChatSearchHit,
} from "@/lib/chat/types";

/** Below this many characters only titles are filtered (locally); from it on the server searches messages too. */
const MESSAGE_SEARCH_MIN = 2;
const SEARCH_DEBOUNCE_MS = 250;

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  chats: ChatMeta[];
  activeChatId?: string;
  onOpenChat: (id: string) => void;
  onNewChat: () => void;
  onRename: (id: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  /** Full-text search over titles and messages. */
  onSearch: (query: string, signal: AbortSignal) => Promise<ChatSearchHit[]>;
}

export function HistoryModal({ isOpen, ...props }: HistoryModalProps) {
  // Mounted only while open so search and edit state reset each time.
  return isOpen ? <HistoryDialog {...props} /> : null;
}

function HistoryDialog({
  onClose,
  chats,
  activeChatId,
  onOpenChat,
  onNewChat,
  onRename,
  onDelete,
  onSearch,
}: Omit<HistoryModalProps, "isOpen">) {
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // On phones, focusing would open the keyboard over the list.
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) searchRef.current?.focus();
  }, []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // Server results for one query; `hits: null` when that search failed (titles are still filtered locally).
  const [search, setSearch] = useState<{ query: string; hits: ChatSearchHit[] | null } | null>(null);

  const trimmed = query.trim();
  const needle = trimmed.toLowerCase();
  const searchesMessages = trimmed.length >= MESSAGE_SEARCH_MIN;

  useEffect(() => {
    if (!searchesMessages) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      onSearch(trimmed, controller.signal).then(
        (hits) => setSearch({ query: trimmed, hits }),
        () => {
          if (!controller.signal.aborted) setSearch({ query: trimmed, hits: null });
        },
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, searchesMessages, onSearch]);

  const result = searchesMessages && search?.query === trimmed ? search : null;
  const searching = searchesMessages && !result;
  // Server hits are shown with the current list's meta, so renames and deletes made here show up straight away.
  const byId = new Map(chats.map((c) => [c.id, c]));
  const snippets = new Map<string, string>();
  const visible = result?.hits
    ? result.hits.flatMap((hit) => {
        const current = byId.get(hit.chat.id);
        if (!current) return [];
        if (hit.snippet) snippets.set(current.id, hit.snippet);
        return [current];
      })
    : needle
      ? chats.filter((c) => c.title.toLowerCase().includes(needle))
      : chats;
  const total = chats.reduce((sum, c) => sum + c.usage.inputTokens + c.usage.outputTokens, 0);

  const saveRename = async (id: string) => {
    const title = draft.trim();
    if (title) await onRename(id, title);
    setEditingId(null);
  };

  return (
    <Modal
      title="Chats"
      description="Saved on this server. Older turns are summarised so continuing a long chat stays cheap."
      onClose={onClose}
      width="sm:max-w-xl"
      footer={
        <>
          <span className="font-mono text-[11px] text-fg-muted">
            {chats.length} {chats.length === 1 ? "chat" : "chats"}
            {total > 0 && ` · ${formatTokens({ inputTokens: total, outputTokens: 0 })} tok`}
          </span>
          <PrimaryButton
            onClick={() => {
              onNewChat();
              onClose();
            }}
          >
            New chat
          </PrimaryButton>
        </>
      }
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
        <label htmlFor="chat-search" className="sr-only">
          Search chats
        </label>
        <input
          id="chat-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search chats"
          className={`${inputClass} pl-10 ${searching ? "pr-10" : ""}`}
          ref={searchRef}
        />
        {searching && (
          <CadenceMark spinning size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
        )}
      </div>

      {visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-fg-muted">
          {chats.length === 0
            ? "No saved chats yet — ask the coach something to start one."
            : searching
              ? "Searching messages…"
              : searchesMessages
                ? `No chats mention “${trimmed}”.`
                : "No chats match."}
        </p>
      ) : (
        <ul className="-mx-2 flex flex-col">
          {visible.map((chat) => {
            const isActive = chat.id === activeChatId;
            if (editingId === chat.id) {
              return (
                <li key={chat.id} className="flex items-center gap-2 px-2 py-1.5">
                  <label htmlFor={`rename-${chat.id}`} className="sr-only">
                    Chat title
                  </label>
                  <input
                    id={`rename-${chat.id}`}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void saveRename(chat.id);
                      if (e.key === "Escape") {
                        e.stopPropagation();
                        setEditingId(null);
                      }
                    }}
                    onFocus={(e) => e.target.select()}
                    className={`${inputClass} h-9`}
                    autoFocus
                  />
                  <RowButton label="Save title" onClick={() => saveRename(chat.id)}>
                    <Check className="h-4 w-4" />
                  </RowButton>
                  <RowButton label="Cancel" onClick={() => setEditingId(null)}>
                    <X className="h-4 w-4" />
                  </RowButton>
                </li>
              );
            }
            if (confirmingId === chat.id) {
              return (
                <li key={chat.id} className="flex items-center gap-3 rounded-lg bg-ink-raised px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-[13px]">
                    Delete “{chat.title}”? <span className="text-fg-muted">This can’t be undone.</span>
                  </span>
                  <GhostButton onClick={() => setConfirmingId(null)}>Keep</GhostButton>
                  <button
                    type="button"
                    onClick={async () => {
                      await onDelete(chat.id);
                      setConfirmingId(null);
                    }}
                    className="h-10 rounded-lg border border-signal-warn/50 px-4 text-[13px] text-signal-warn transition hover:bg-signal-warn/10"
                  >
                    Delete
                  </button>
                </li>
              );
            }
            return (
              <li key={chat.id} className="group flex items-center gap-1 rounded-lg transition hover:bg-ink-raised">
                <button
                  type="button"
                  onClick={() => {
                    onOpenChat(chat.id);
                    onClose();
                  }}
                  aria-current={isActive ? "true" : undefined}
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-3 px-3 py-1.5 text-left"
                >
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isActive ? "bg-signal" : "bg-transparent"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px]">{chat.title}</span>
                    {snippets.has(chat.id) && (
                      <span className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-fg-muted">
                        <Snippet text={snippets.get(chat.id)!} />
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-fg-muted">
                    {formatChatDate(chat.updatedAt)}
                    {chat.usage.inputTokens + chat.usage.outputTokens > 0 && ` · ${formatTokens(chat.usage)}`}
                  </span>
                </button>
                <div className="flex items-center pr-1 transition sm:opacity-0 sm:focus-within:opacity-100 sm:group-hover:opacity-100">
                  <RowButton
                    label="Rename"
                    onClick={() => {
                      setDraft(chat.title);
                      setEditingId(chat.id);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </RowButton>
                  <RowButton label="Delete" onClick={() => setConfirmingId(chat.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </RowButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}

/** Search snippet with the matched words highlighted (marked by the server with control characters, not HTML). */
function Snippet({ text }: { text: string }) {
  const parts = text.split(new RegExp(`${SNIPPET_MARK_START}(.*?)${SNIPPET_MARK_END}`, "g"));
  return parts.map((part, i) =>
    i % 2 ? (
      <mark key={i} className="rounded-sm bg-signal/20 px-0.5 text-fg">
        {part}
      </mark>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    ),
  );
}

function RowButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-fg-muted transition hover:bg-ink-line hover:text-fg sm:h-9 sm:w-9"
    >
      {children}
    </button>
  );
}
