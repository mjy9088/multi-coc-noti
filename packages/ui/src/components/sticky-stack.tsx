"use client";

import {
  type CSSProperties,
  createContext,
  type ElementType,
  type HTMLAttributes,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "../lib/cn";

type StickyEntry = { height: number; order: number };
type StickyStackContextValue = {
  entries: ReadonlyMap<string, StickyEntry>;
  totalHeight: number;
  update: (id: string, entry: StickyEntry | null) => void;
};
type StackStyle = CSSProperties & Record<`--ui-${string}`, string>;

const StickyStackContext = createContext<StickyStackContextValue | null>(null);

export function useStickyStack() {
  const context = useContext(StickyStackContext);
  if (!context) throw new Error("useStickyStack must be used inside StickyStackProvider");
  return { totalHeight: context.totalHeight };
}

export function StickyStackProvider({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  const [entries, setEntries] = useState<ReadonlyMap<string, StickyEntry>>(() => new Map());
  const update = useCallback((id: string, entry: StickyEntry | null) => {
    setEntries((current) => {
      const previous = current.get(id);
      if (entry && previous?.height === entry.height && previous.order === entry.order) return current;
      if (!entry && !previous) return current;
      const next = new Map(current);
      if (entry) next.set(id, entry);
      else next.delete(id);
      return next;
    });
  }, []);
  const totalHeight = [...entries.values()].reduce((total, entry) => total + entry.height, 0);
  const value = useMemo(() => ({ entries, totalHeight, update }), [entries, totalHeight, update]);
  const style = {
    ...props.style,
    "--ui-sticky-stack-total-offset": `${totalHeight}px`,
    "--ui-viewport-available-height": `calc(100dvh - ${totalHeight}px)`,
  } as StackStyle;

  return (
    <StickyStackContext value={value}>
      <div className={cn("ui-sticky-stack-root", className)} {...props} style={style}>
        {children}
      </div>
    </StickyStackContext>
  );
}

type StickyStackItemProps = HTMLAttributes<HTMLElement> & {
  as?: Extract<ElementType, "div" | "header" | "nav">;
  order: number;
};

export function StickyStackItem({ as: Component = "div", className, order, style, ...props }: StickyStackItemProps) {
  const context = useContext(StickyStackContext);
  if (!context) throw new Error("StickyStackItem must be rendered inside StickyStackProvider");
  const id = useId();
  const elementRef = useRef<HTMLElement>(null);
  const offset = [...context.entries.entries()]
    .filter(([entryId, entry]) => entryId !== id && entry.order < order)
    .reduce((total, [, entry]) => total + entry.height, 0);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    const measure = () => context.update(id, { height: element.getBoundingClientRect().height, order });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
      context.update(id, null);
    };
  }, [context.update, id, order]);

  const stackStyle = { ...style, "--ui-sticky-stack-offset": `${offset}px` } as StackStyle;
  return (
    <Component
      ref={(element) => {
        elementRef.current = element;
      }}
      className={cn("ui-sticky-stack-item ui-sticky-surface", className)}
      style={stackStyle}
      {...props}
    />
  );
}

export function StickyStackViewport({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  const context = useContext(StickyStackContext);
  if (!context) throw new Error("StickyStackViewport must be rendered inside StickyStackProvider");
  const anchorRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [fixedBox, setFixedBox] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const viewport = viewportRef.current;
    if (!anchor || !viewport) return;
    const update = () => {
      const anchorBounds = anchor.getBoundingClientRect();
      const stickyTop = Number.parseFloat(getComputedStyle(viewport).top) || context.totalHeight;
      const next = anchorBounds.top <= stickyTop ? { left: anchorBounds.left, width: anchorBounds.width } : null;
      setFixedBox((current) => (current?.left === next?.left && current?.width === next?.width ? current : next));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const observer = new ResizeObserver(update);
    observer.observe(anchor);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer.disconnect();
    };
  }, [context.totalHeight]);

  return (
    <div ref={anchorRef} className="ui-sticky-stack-viewport-anchor">
      <div
        ref={viewportRef}
        {...props}
        className={cn("ui-split-layout ui-sticky-stack-viewport", className)}
        data-fixed={fixedBox ? "true" : undefined}
        style={fixedBox ? { ...props.style, left: fixedBox.left, width: fixedBox.width } : props.style}
      />
    </div>
  );
}

type StickyRouteFrameProps = HTMLAttributes<HTMLDivElement> & { scrollKey: string; contained?: boolean };

export function StickyRouteFrame({ className, contained = false, scrollKey, ...props }: StickyRouteFrameProps) {
  const context = useContext(StickyStackContext);
  if (!context && !contained) throw new Error("StickyRouteFrame must be rendered inside StickyStackProvider");
  const totalHeight = context?.totalHeight ?? 0;
  const anchorRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [fixedBox, setFixedBox] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    void scrollKey;
    frameRef.current?.scrollTo({ top: 0 });
  }, [scrollKey]);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const update = () => {
      const anchorBounds = anchor.getBoundingClientRect();
      const next = anchorBounds.top <= totalHeight + 1 ? { left: anchorBounds.left, width: anchorBounds.width } : null;
      setFixedBox((current) => (current?.left === next?.left && current?.width === next?.width ? current : next));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const observer = new ResizeObserver(update);
    observer.observe(anchor);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer.disconnect();
    };
  }, [totalHeight]);

  if (contained) return <div {...props} className={cn("ui-sticky-route-frame-contained", className)} />;

  return (
    <div ref={anchorRef} className="ui-sticky-route-frame-anchor">
      <div
        ref={frameRef}
        {...props}
        className={cn("ui-sticky-route-frame", className)}
        data-fixed={fixedBox ? "true" : undefined}
        style={fixedBox ? { ...props.style, left: fixedBox.left, width: fixedBox.width } : props.style}
      />
    </div>
  );
}
