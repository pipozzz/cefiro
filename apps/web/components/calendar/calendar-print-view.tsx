"use client";

import { useEffect, useMemo, useRef } from "react";
import { SLOTS } from "@/components/calendar/mobile/types";
import { useCalendarQuery } from "@/hooks/calendar/use-calendar-query";
import { useLocale, useTranslations } from "next-intl";

import type { Slot } from "@norish/shared/contracts";
import { dateKey, eachDayOfInterval, getWeekEnd, getWeekStart } from "@norish/shared/lib/helpers";

/**
 * A print-only, non-virtualized rendering of the meal plan for a date range as
 * a Monday-based calendar grid (one row per week). It is hidden on screen
 * (`hidden print:block`) and, in print, a visibility rule hides the rest of the
 * app so only this grid prints — which also sidesteps the live timeline's
 * virtualization (it only mounts visible rows). Mounted on demand; auto-opens
 * the print dialog once the range's data has loaded, then calls `onAfterPrint`.
 */
export function CalendarPrintView({
  start,
  end,
  onAfterPrint,
}: {
  start: Date;
  end: Date;
  onAfterPrint: () => void;
}) {
  const locale = useLocale();
  const t = useTranslations("calendar.print");
  const tSlots = useTranslations("common.slots");

  const startKey = dateKey(start);
  const endKey = dateKey(end);

  const { calendarData, isLoading, error } = useCalendarQuery(startKey, endKey);

  // Full weeks (Mon–Sun) covering the range, chunked into rows of 7.
  const weeks = useMemo(() => {
    const days = eachDayOfInterval(getWeekStart(start), getWeekEnd(end));
    const rows: Date[][] = [];

    for (let i = 0; i < days.length; i += 7) {
      rows.push(days.slice(i, i + 7));
    }

    return rows;
  }, [start, end]);

  const weekdayNames = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: "short" });

    return (weeks[0] ?? []).map((day) => fmt.format(day));
  }, [weeks, locale]);

  const slotLabel: Record<Slot, string> = {
    Breakfast: tSlots("breakfast"),
    Lunch: tSlots("lunch"),
    Dinner: tSlots("dinner"),
    Snack: tSlots("snack"),
  };

  const rangeLabel = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    return `${fmt.format(start)} – ${fmt.format(end)}`;
  }, [start, end, locale]);

  // Open the print dialog once the data has settled (and reset on cancel/close).
  const printedRef = useRef(false);

  useEffect(() => {
    if (printedRef.current) {
      return;
    }

    if (error) {
      printedRef.current = true;
      onAfterPrint();

      return;
    }

    if (isLoading) {
      return;
    }

    printedRef.current = true;

    const handleAfterPrint = () => {
      window.removeEventListener("afterprint", handleAfterPrint);
      onAfterPrint();
    };

    window.addEventListener("afterprint", handleAfterPrint);
    const raf = requestAnimationFrame(() => window.print());

    return () => cancelAnimationFrame(raf);
  }, [isLoading, error, onAfterPrint]);

  const inRange = (day: Date) => {
    const key = dateKey(day);

    return key >= startKey && key <= endKey;
  };

  return (
    <>
      <style>{`
        @page { size: A4 landscape; margin: 10mm; }
        @media print {
          body * { visibility: hidden !important; }
          #calendar-print, #calendar-print * { visibility: visible !important; }
          #calendar-print { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>

      <div className="hidden text-black print:block" id="calendar-print">
        <div className="mb-3 flex items-baseline justify-between border-b border-gray-400 pb-2">
          <h1 className="text-xl font-bold">{t("title")}</h1>
          <span className="text-sm text-gray-600">{rangeLabel}</span>
          <span className="text-sm font-semibold text-gray-700">Naša Kuchyňa</span>
        </div>

        <div className="grid grid-cols-7">
          {weekdayNames.map((name, i) => (
            <div
              key={i}
              className="border-b border-gray-400 pb-1 text-center text-xs font-semibold tracking-wide uppercase"
            >
              {name}
            </div>
          ))}
        </div>

        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7">
            {week.map((day) => {
              const items = calendarData[dateKey(day)] ?? [];
              const faded = inRange(day) ? "" : "text-gray-300";

              return (
                <div
                  key={dateKey(day)}
                  className="min-h-[110px] break-inside-avoid border border-gray-300 p-1.5 align-top"
                >
                  <div className={`mb-1 text-right text-sm font-semibold ${faded}`}>
                    {day.getDate()}
                  </div>

                  {SLOTS.map((slot) => {
                    const slotItems = items.filter((item) => item.slot === slot);

                    if (slotItems.length === 0) {
                      return null;
                    }

                    return (
                      <div key={slot} className="mb-1">
                        <div className="text-[9px] font-semibold tracking-wide text-gray-500 uppercase">
                          {slotLabel[slot]}
                        </div>
                        <ul className="text-[11px] leading-tight text-black">
                          {slotItems.map((item) => (
                            <li key={item.id} className="truncate">
                              {item.itemType === "recipe"
                                ? (item.recipeName ?? "—")
                                : (item.title ?? "—")}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}
