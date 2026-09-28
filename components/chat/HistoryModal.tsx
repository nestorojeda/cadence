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
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted pointer-events-none" />
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
        <p className="text-sm text-fg-muted py-6 text-center">
          {chats.length === 0 ? "No saved chats yet — ask the coach something to start one." : "No chats match."}
        </p>
      ) : (
        <ul className="flex flex-col -mx-2">
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
                    <Check className="w-4 h-4" />
                  </RowButton>
                  <RowButton label="Cancel" onClick={() => setEditingId(null)}>
                    <X className="w-4 h-4" />
                  </RowButton>
                </li>
              );
            }
            if (confirmingId === chat.id) {
              return (
                <li key={chat.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-ink-raised">
                  <span className="flex-1 min-w-0 text-[13px] truncate">
                    Delete “{chat.title}”? <span className="text-fg-muted">This can’t be undone.</span>
                  </span>
                  <GhostButton onClick={() => setConfirmingId(null)}>Keep</GhostButton>
                  <button
                    type="button"
                    onClick={async () => {
                      await onDelete(chat.id);
                      setConfirmingId(null);
                    }}
                    className="h-10 px-4 rounded-lg border border-signal-warn/50 text-[13px] text-signal-warn transition hover:bg-signal-warn/10"
                  >
                    Delete
                  </button>
                </li>
              );
            }
            return (
              <li key={chat.id} className="group flex items-center gap-1 rounded-lg hover:bg-ink-raised transition">
                <button
                  type="button"
                  onClick={() => {
                    onOpenChat(chat.id);
                    onClose();
                  }}
                  aria-current={isActive ? "true" : undefined}
                  className="flex-1 min-w-0 flex items-center gap-3 h-11 px-3 text-left"
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? "bg-signal" : "bg-transparent"}`} />
                  <span className="flex-1 min-w-0 truncate text-[13px]">{chat.title}</span>
                  <span className="font-mono text-[11px] text-fg-muted shrink-0">
                    {formatChatDate(chat.updatedAt)}
                    {chat.usage.inputTokens + chat.usage.outputTokens > 0 && ` · ${formatTokens(chat.usage)}`}
                  </span>
                </button>
                <div className="flex items-center pr-1 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition">
                  <RowButton
                    label="Rename"
                    onClick={() => {
                      setDraft(chat.title);
                      setEditingId(chat.id);
                    }}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </RowButton>
                  <RowButton label="Delete" onClick={() => setConfirmingId(chat.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
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
      className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg text-fg-muted hover:text-fg hover:bg-ink-line transition"
    >
      {children}
    </button>
  );
}
