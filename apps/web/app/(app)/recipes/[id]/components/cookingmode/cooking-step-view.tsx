"use client";

import type { ComponentType } from "react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { SmartInstruction } from "@/components/recipe/smart-instruction";
import { StepIngredientsRow } from "@/components/recipes/step-ingredients-row";
import { BookOpenIcon } from "@heroicons/react/20/solid";
import { Chip, Surface } from "@heroui/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";

import type { ResolvedCookingModeStep } from "./cooking-mode-steps";
import type { CookingModeDialogProps } from "./types";
import { StepImages } from "./step-images";

/**
 * The renderer for a step's prose. Defaults to the in-app {@link SmartInstruction}
 * (timer chips + step-ingredient mentions from authenticated config); the public
 * recipe page injects its slug-scoped, auth-free equivalent so discovery's cook
 * mode is the same view as the library's without reaching for private hooks.
 */
export type StepInstructionComponent = ComponentType<{
  text: string;
  recipeId: string;
  recipeName?: string;
  stepIndex: number;
}>;

type CookingStepViewProps = Pick<
  CookingModeDialogProps,
  "activeStep" | "displayIngredients" | "recipe"
> & {
  steps: ResolvedCookingModeStep[];
  InstructionComponent?: StepInstructionComponent;
};

/**
 * Room each peek takes: two clamped lines of the step's own type size. Both
 * edges reserve it whether or not there is a neighbour to put in it, which is
 * what puts the step a cook is on in the middle of the screen on the first and
 * last pages as well as in between.
 */
const PEEK_BLOCK_PX = 88;

/** What a long step leaves free instead, so the swipe still has somewhere to start. */
const SWIPE_EDGE_PX = 32;

/**
 * Marks the region a long step scrolls inside. A vertical drag that starts in
 * here is a scroll, so it must not also turn the page — cooking mode reads
 * this to suppress that one gesture and nothing else.
 */
export const STEP_SCROLL_ATTRIBUTE = "data-cooking-step-scroll";

/** Marks a reserved edge, so the flanking of the step is testable without class names. */
const STEP_PEEK_ATTRIBUTE = "data-cooking-step-peek";

/**
 * The page turn's pace: the odometer's (animated-number.tsx), slow enough to
 * read as the strip of steps travelling and brisk enough not to hold up a
 * cook mid-swipe.
 */
const PAGE_TRANSITION = { duration: 0.4, ease: [0.22, 0.61, 0.36, 1] } as const;

/** The turn under reduced motion: announce the change, move nothing. */
const REDUCED_MOTION_TRANSITION = { duration: 0.15, ease: "linear" } as const;

/**
 * The steps read as one vertical strip and a turn moves the whole strip: the
 * page on screen slides fully out one edge while the next slides in from the
 * other, in lockstep. `custom` carries the turn's direction — +1 forward,
 * -1 back — and AnimatePresence's own `custom` prop re-aims the leaving page
 * at exit time, because a page stops receiving props the moment its step is
 * no longer the active one.
 */
const pageVariants = {
  center: { y: "0%" },
  enter: (direction: number) => ({ y: direction > 0 ? "100%" : "-100%" }),
  exit: (direction: number) => ({ y: direction > 0 ? "-100%" : "100%" }),
};

/** Under reduced motion the pages trade places as a brief crossfade instead. */
const reducedMotionVariants = {
  center: { opacity: 1 },
  enter: { opacity: 0 },
  exit: { opacity: 0 },
};

/**
 * A neighbouring step, in the step's own words at the step's own size and
 * faded almost out. Shrinking it to a caption would read as a footnote about
 * the step rather than as the step either side of it.
 */
function StepPeek({ text, edge }: { text: string; edge: "top" | "bottom" }) {
  return (
    <p
      className={`text-foreground line-clamp-2 text-2xl leading-relaxed font-medium opacity-25 md:text-3xl md:leading-relaxed ${
        edge === "top"
          ? "[mask-image:linear-gradient(to_bottom,transparent,black)]"
          : "[mask-image:linear-gradient(to_top,transparent,black)]"
      }`}
    >
      {text}
    </p>
  );
}

type StepPageProps = Pick<CookingStepViewProps, "displayIngredients" | "recipe"> & {
  direction: 1 | -1;
  next?: ResolvedCookingModeStep;
  previous?: ResolvedCookingModeStep;
  step: ResolvedCookingModeStep;
  InstructionComponent: StepInstructionComponent;
};

/**
 * One page of the strip: a step flanked by its peeks. Each page is its own
 * instance, keyed by step — the fit measurement, the collapsed-peeks answer
 * and a long step's scroll position all belong to the page, so a page
 * mid-exit keeps its own layout and a fresh page always starts at the top.
 */
function StepPage({
  direction,
  displayIngredients,
  next,
  previous,
  recipe,
  step,
  InstructionComponent,
}: StepPageProps) {
  const prefersReducedMotion = useReducedMotion();
  const pageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [peeksFit, setPeeksFit] = useState(true);

  const measure = useCallback(() => {
    const page = pageRef.current;
    const content = contentRef.current;

    if (!page || !content) return;

    // Measured against the page rather than against the current layout, so
    // collapsing the peeks can never change the answer and flip it back.
    setPeeksFit(content.scrollHeight <= page.clientHeight - PEEK_BLOCK_PX * 2);
  }, []);

  useLayoutEffect(measure, [measure, step]);

  useEffect(() => {
    const page = pageRef.current;
    const content = contentRef.current;

    if (!page || !content || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(measure);

    observer.observe(page);
    observer.observe(content);

    return () => observer.disconnect();
  }, [measure]);

  // One number for both edges, so the height the layout reserves and the height
  // the fit is measured against cannot say different things.
  const slotHeight = peeksFit ? PEEK_BLOCK_PX : SWIPE_EDGE_PX;

  return (
    <motion.div
      ref={pageRef}
      animate="center"
      className="absolute inset-0 flex flex-col px-5 py-3 md:px-8 md:py-4"
      custom={direction}
      exit="exit"
      initial="enter"
      transition={prefersReducedMotion ? REDUCED_MOTION_TRANSITION : PAGE_TRANSITION}
      variants={prefersReducedMotion ? reducedMotionVariants : pageVariants}
    >
      {/* Reserved either way: an empty edge on the first page keeps the step
          where it was on the page before it. Each peek lives in the same
          centred column as the step itself — a peek that starts at the page
          edge while the step starts at the column edge reads as two layouts
          on one screen. */}
      <div
        aria-hidden
        className="mx-auto flex w-full max-w-3xl shrink-0 items-end overflow-hidden"
        style={{ height: slotHeight }}
        {...{ [STEP_PEEK_ATTRIBUTE]: "top" }}
      >
        {peeksFit && previous ? <StepPeek edge="top" text={previous.text} /> : null}
      </div>

      <div
        className={`flex min-h-0 flex-1 ${
          peeksFit ? "items-center overflow-hidden" : "items-start overflow-y-auto"
        }`}
        {...(peeksFit ? {} : { [STEP_SCROLL_ATTRIBUTE]: "true" })}
      >
        <div ref={contentRef} className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          {step.heading ? (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Chip color="accent" variant="soft">
                <BookOpenIcon className="size-4 translate-y-px" />
                <Chip.Label>{step.heading}</Chip.Label>
              </Chip>
            </div>
          ) : null}

          <div className="text-foreground min-w-0 text-2xl leading-relaxed font-medium md:text-3xl md:leading-relaxed">
            <InstructionComponent
              recipeId={recipe.id}
              recipeName={recipe.name}
              stepIndex={step.originalIndex}
              text={step.text}
            />
          </div>

          {step.stepIngredients.length > 0 && (
            // The current step's ingredients and amounts, in front of the
            // cook exactly when hands are full — derived from the same
            // servings-adjusted lines the ingredients view shows. A Step
            // Ingredient is a share of a line, not a word in the sentence,
            // so it stays a chip row rather than a decoration on the prose.
            <StepIngredientsRow
              ingredients={displayIngredients}
              refs={step.stepIngredients}
              systemUsed={recipe.systemUsed}
            />
          )}

          <StepImages step={step} />
        </div>
      </div>

      <div
        aria-hidden
        className="mx-auto flex w-full max-w-3xl shrink-0 items-start overflow-hidden"
        style={{ height: slotHeight }}
        {...{ [STEP_PEEK_ATTRIBUTE]: "bottom" }}
      >
        {peeksFit && next ? <StepPeek edge="bottom" text={next.text} /> : null}
      </div>
    </motion.div>
  );
}

/**
 * One step per screen, centred, with the steps either side peeking at the
 * edges so a cook keeps their bearings without leaving the step they are on.
 * A step too long for what the peeks leave takes the whole page and scrolls
 * inside it — context is never worth the words a cook is trying to read — and
 * the vertical swipe keeps working from the strips at the top and bottom.
 *
 * Turning the page moves it: forward slides the strip up, back slides it
 * down, whichever control turned it — swipe, chevron, arrow key. A swap with
 * no travel reads as a repaint and gives no sense of where in the recipe the
 * cook just went.
 *
 * The step carries no number of its own: the bottom bar counts the steps, and
 * a badge above the prose pulls the eye off the one thing this screen is for.
 */
export function CookingStepView({
  activeStep,
  displayIngredients,
  recipe,
  steps,
  InstructionComponent = SmartInstruction,
}: CookingStepViewProps) {
  const tCookMode = useTranslations("recipes.cookMode");
  // Which way this turn travels, decided during render so it is settled
  // before the entering page mounts. The ref survives the pages themselves
  // coming and going, and mutating it is idempotent under a re-render.
  const lastStepRef = useRef(activeStep);
  const directionRef = useRef<1 | -1>(1);

  if (activeStep !== lastStepRef.current) {
    directionRef.current = activeStep > lastStepRef.current ? 1 : -1;
    lastStepRef.current = activeStep;
  }

  const step = steps[activeStep];
  const previous = activeStep > 0 ? steps[activeStep - 1] : undefined;
  const next = activeStep < steps.length - 1 ? steps[activeStep + 1] : undefined;

  if (!step) {
    return (
      <Surface
        className="text-muted flex min-h-64 items-center justify-center p-6"
        variant="secondary"
      >
        {tCookMode("steps")}
      </Surface>
    );
  }

  return (
    // The frame the pages travel through. Opening cooking mode does not
    // animate — the first page is simply there — and the clip keeps a page
    // mid-turn from sliding over the header or the bottom bar.
    <div className="relative h-full min-h-0 overflow-hidden">
      <AnimatePresence custom={directionRef.current} initial={false}>
        <StepPage
          key={activeStep}
          InstructionComponent={InstructionComponent}
          direction={directionRef.current}
          displayIngredients={displayIngredients}
          next={next}
          previous={previous}
          recipe={recipe}
          step={step}
        />
      </AnimatePresence>
    </div>
  );
}
