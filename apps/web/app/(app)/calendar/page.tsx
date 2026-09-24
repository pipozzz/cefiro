"use client";

import type { PlannedItemDisplay } from "@/components/calendar/mobile/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarPrintView } from "@/components/calendar/calendar-print-view";
import { DesktopTimeline } from "@/components/calendar/desktop";
import { MobileTimeline } from "@/components/calendar/mobile";
import { EditNotePanel } from "@/components/Panel/consumers/edit-note-panel";
import { EditPlannedRecipePanel } from "@/components/Panel/consumers/edit-planned-recipe-panel";
import MiniRecipes from "@/components/Panel/consumers/mini-recipes";
import { PrinterIcon } from "@heroicons/react/24/outline";
import { Button } from "@heroui/react";
import { useTranslations } from "next-intl";
import { useWindowSize } from "usehooks-ts";

import type { Slot } from "@norish/shared/contracts";
import { endOfMonth, getWeekEnd, getWeekStart, startOfMonth } from "@norish/shared/lib/helpers";

import { CalendarContextProvider } from "./context";

function CalendarPageContent() {
  const [miniRecipesOpen, setMiniRecipesOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<Slot | undefined>(undefined);
  const pendingMiniRecipesScrollYRef = useRef<number | null>(null);
  const restoreMiniRecipesScrollTimerRef = useRef<number | null>(null);

  const tPrint = useTranslations("calendar.print");

  // Printable meal-plan range (null while not printing). Rendered by a hidden,
  // non-virtualized print view that opens the print dialog and resets on close.
  const [printRange, setPrintRange] = useState<{ start: Date; end: Date } | null>(null);

  const printWeek = useCallback(() => {
    const now = new Date();

    setPrintRange({ start: getWeekStart(now), end: getWeekEnd(now) });
  }, []);

  const printMonth = useCallback(() => {
    const now = new Date();

    setPrintRange({ start: startOfMonth(now), end: endOfMonth(now) });
  }, []);

  // Note editing state
  const [editingNote, setEditingNote] = useState<PlannedItemDisplay | null>(null);

  // Recipe editing state
  const [editingRecipe, setEditingRecipe] = useState<PlannedItemDisplay | null>(null);

  // Responsive: use desktop view for md+ (768px)
  const { width = 768 } = useWindowSize();
  const isDesktop = width >= 768;

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && restoreMiniRecipesScrollTimerRef.current !== null) {
        window.clearTimeout(restoreMiniRecipesScrollTimerRef.current);
      }
    };
  }, []);

  const restoreMiniRecipesScroll = useCallback(() => {
    if (typeof window === "undefined") return;

    const scrollY = pendingMiniRecipesScrollYRef.current;

    if (scrollY === null) return;

    pendingMiniRecipesScrollYRef.current = null;

    const restore = () => {
      window.scrollTo({
        top: scrollY,
        behavior: "auto",
      });
    };

    if (restoreMiniRecipesScrollTimerRef.current !== null) {
      window.clearTimeout(restoreMiniRecipesScrollTimerRef.current);
    }

    requestAnimationFrame(restore);
    restoreMiniRecipesScrollTimerRef.current = window.setTimeout(() => {
      restore();
      restoreMiniRecipesScrollTimerRef.current = null;
    }, 550);
  }, []);

  const handleMiniRecipesOpenChange = useCallback(
    (open: boolean) => {
      setMiniRecipesOpen(open);

      if (!open) {
        restoreMiniRecipesScroll();
      }
    },
    [restoreMiniRecipesScroll]
  );

  const handleAddItem = useCallback((dateKey: string, slot: Slot) => {
    // Parse the dateKey (YYYY-MM-DD format) into a Date
    const [year, month, day] = dateKey.split("-").map(Number);

    if (year === undefined || month === undefined || day === undefined) {
      return;
    }

    if (typeof window !== "undefined") {
      if (restoreMiniRecipesScrollTimerRef.current !== null) {
        window.clearTimeout(restoreMiniRecipesScrollTimerRef.current);
        restoreMiniRecipesScrollTimerRef.current = null;
      }

      pendingMiniRecipesScrollYRef.current = window.scrollY;
    }

    setSelectedDate(new Date(year, month - 1, day));
    setSelectedSlot(slot);
    setMiniRecipesOpen(true);
  }, []);

  const handleNoteClick = (item: PlannedItemDisplay) => {
    setEditingNote(item);
  };

  const handleRecipeClick = (item: PlannedItemDisplay) => {
    setEditingRecipe(item);
  };

  const TimelineComponent = isDesktop ? DesktopTimeline : MobileTimeline;

  return (
    <>
      <div className="flex items-center justify-end gap-2 px-4 pt-4 print:hidden">
        <span className="text-default-500 text-sm">{tPrint("label")}</span>
        <Button size="sm" variant="secondary" onPress={printWeek}>
          <PrinterIcon className="h-4 w-4" />
          {tPrint("week")}
        </Button>
        <Button size="sm" variant="secondary" onPress={printMonth}>
          {tPrint("month")}
        </Button>
      </div>

      <TimelineComponent
        onAddItem={handleAddItem}
        onNoteClick={handleNoteClick}
        onRecipeClick={handleRecipeClick}
      />

      {printRange ? (
        <CalendarPrintView
          end={printRange.end}
          start={printRange.start}
          onAfterPrint={() => setPrintRange(null)}
        />
      ) : null}

      {/* Mini recipes panel for adding items */}
      <MiniRecipes
        date={selectedDate}
        open={miniRecipesOpen}
        slot={selectedSlot}
        onOpenChange={handleMiniRecipesOpenChange}
      />

      {/* Edit note panel */}
      {editingNote && (
        <EditNotePanel
          date={editingNote.date}
          initialTitle={editingNote.title ?? ""}
          noteId={editingNote.id}
          open={!!editingNote}
          slot={editingNote.slot}
          onOpenChange={(open) => {
            if (!open) setEditingNote(null);
          }}
        />
      )}

      {/* Edit planned recipe panel */}
      {editingRecipe && (
        <EditPlannedRecipePanel
          date={editingRecipe.date}
          itemId={editingRecipe.id}
          open={!!editingRecipe}
          recipeId={editingRecipe.recipeId ?? ""}
          recipeImage={editingRecipe.recipeImage ?? null}
          recipeName={editingRecipe.recipeName ?? ""}
          slot={editingRecipe.slot}
          onOpenChange={(open) => {
            if (!open) setEditingRecipe(null);
          }}
        />
      )}
    </>
  );
}

export default function CalendarPage() {
  return (
    <CalendarContextProvider>
      <CalendarPageContent />
    </CalendarContextProvider>
  );
}
