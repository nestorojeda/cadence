"use client";

import React, { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { GhostButton, Modal, ModalSection } from "@/components/ui/Modal";
import { EMPTY_MEMORY, MEMORY_CATEGORIES, MEMORY_CATEGORY_LABELS, type AthleteMemory } from "@/lib/coach/memory";

interface CoachMemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  athleteId: string;
}

const shortDate = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });

export function CoachMemoryModal({ isOpen, onClose, athleteId }: CoachMemoryModalProps) {
  const [memory, setMemory] = useState<AthleteMemory>(EMPTY_MEMORY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    fetch(`/api/memory?athleteId=${encodeURIComponent(athleteId)}`)
      .then((res) => res.json() as Promise<AthleteMemory | { error: string }>)
      .then((data) => {
        if ("error" in data) setError(data.error);
        else setMemory(data);
      })
      .catch(() => setError("Couldn’t load the coach’s memory."))
      .finally(() => setLoading(false));
  }, [isOpen, athleteId]);

  if (!isOpen) return null;

  const remove = async (body: { factId: string } | { plan: true }) => {
    setError(null);
    try {
      const res = await fetch("/api/memory", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId, ...body }),
      });
      const data = (await res.json()) as AthleteMemory | { error: string };
      if ("error" in data) setError(data.error);
      else setMemory(data);
    } catch {
      setError("Couldn’t update the coach’s memory.");
    }
  };

  const groups = MEMORY_CATEGORIES.map((category) => ({
    category,
    facts: memory.facts.filter((f) => f.category === category),
  })).filter((g) => g.facts.length > 0);

  return (
    <Modal
      title="Coach memory"
      description="What the coach carries from one chat to the next. It adds to this as you talk."
      onClose={onClose}
      footer={
        <>
          <span role="status" className="text-xs text-signal-warn">
            {error}
          </span>
          <GhostButton onClick={onClose}>Done</GhostButton>
        </>
      }
    >
      {loading ? (
        <span className="font-mono text-xs text-fg-muted">Loading…</span>
      ) : (
        <>
          <ModalSection label="Current plan">
            {memory.plan ? (
              <div className="flex flex-col gap-2 rounded-[10px] border border-ink-line px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-mono text-[11px] text-fg-muted">
                      {[memory.plan.phase, `updated ${shortDate(memory.plan.updatedAt)}`].filter(Boolean).join(" · ")}
                    </span>
                    <span className="text-[15px] font-medium">{memory.plan.focus}</span>
                  </div>
                  <DeleteButton label="Clear the plan note" onClick={() => remove({ plan: true })} />
                </div>
                {memory.plan.text && (
                  <p className="whitespace-pre-line text-[13px] leading-relaxed text-fg-subtle">{memory.plan.text}</p>
                )}
              </div>
            ) : (
              <p className="text-[13px] text-fg-muted">No plan yet. The coach writes one when it plans your week.</p>
            )}
          </ModalSection>

          <ModalSection
            label="What the coach remembers"
            hint="Temporary facts drop off after their end date. Change a standing rule in Coach rules instead."
          >
            {groups.length === 0 ? (
              <p className="text-[13px] text-fg-muted">
                Nothing yet. Mention injuries, travel or how sessions felt, and the coach will keep a note.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {groups.map(({ category, facts }) => (
                  <div key={category} className="flex flex-col">
                    <span className="pb-1 font-mono text-[11px] text-fg-muted">
                      {MEMORY_CATEGORY_LABELS[category].toUpperCase()}
                    </span>
                    {facts.map((fact) => (
                      <div
                        key={fact.id}
                        className="flex items-start justify-between gap-3 border-t border-ink-hair py-2 first:border-t-0"
                      >
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="break-words text-[13px] leading-relaxed">{fact.text}</span>
                          <span className="font-mono text-[11px] text-fg-muted">
                            {[
                              `saved ${shortDate(fact.createdAt)}`,
                              fact.expiresOn ? `until ${shortDate(fact.expiresOn)}` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </div>
                        <DeleteButton label="Forget this" onClick={() => remove({ factId: fact.id })} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </ModalSection>
        </>
      )}
    </Modal>
  );
}

function DeleteButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="-mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-fg-muted transition hover:bg-ink-raised hover:text-fg sm:h-8 sm:w-8"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
