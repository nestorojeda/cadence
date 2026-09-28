"use client";

import React, { useState } from "react";
import { Check, Pencil, Search, Trash2, X } from "lucide-react";
import { GhostButton, Modal, PrimaryButton, inputClass } from "@/components/ui/Modal";
import { formatChatDate, formatTokens, type ChatMeta } from "@/lib/chat/types";

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  chats: ChatMeta[];
  activeChatId?: string;
  onOpenChat: (id: string) => void;
  onNewChat: () => void;
  onRename: (id: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
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
}: Omit<HistoryModalProps, "isOpen">) {
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const needle = query.trim().toLowerCase();
  const visible = needle ? chats.filter((c) => c.title.toLowerCase().includes(needle)) : chats;
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
          className={`${inputClass} pl-10`}
          autoFocus
        />
      </div>

      {visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-fg-muted">
          {chats.length === 0 ? "No saved chats yet — ask the coach something to start one." : "No chats match."}
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
                      if (e.key === "Enter") saveRename(chat.id);
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
                  className="flex h-11 min-w-0 flex-1 items-center gap-3 px-3 text-left"
                >
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isActive ? "bg-signal" : "bg-transparent"}`} />
                  <span className="min-w-0 flex-1 truncate text-[13px]">{chat.title}</span>
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

function RowButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-fg-muted transition hover:bg-ink-line hover:text-fg"
    >
      {children}
    </button>
  );
}
