import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderContent,
  PageHeaderDescription,
  PageHeaderEyebrow,
  PageHeaderTitle,
  SectionHeader,
  SectionHeaderActions,
  SectionHeaderContent,
  SectionHeaderDescription,
  SectionHeaderTitle,
} from "./page-layout";

type Spacing = "none" | "compact" | "normal" | "loose";

export type PageIntroProps = Omit<HTMLAttributes<HTMLElement>, "className" | "title"> & {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  spacing?: Spacing;
  className?: string;
};

export function PageIntro({
  title,
  eyebrow,
  description,
  actions,
  spacing = "normal",
  className,
  ...props
}: PageIntroProps) {
  return (
    <PageHeader className={cn("ui-page-intro", className)} data-spacing={spacing} {...props}>
      <PageHeaderContent>
        {eyebrow && <PageHeaderEyebrow>{eyebrow}</PageHeaderEyebrow>}
        <PageHeaderTitle>{title}</PageHeaderTitle>
        {description && <PageHeaderDescription>{description}</PageHeaderDescription>}
      </PageHeaderContent>
      {actions && <PageHeaderActions>{actions}</PageHeaderActions>}
    </PageHeader>
  );
}

export type ContentSectionProps = Omit<HTMLAttributes<HTMLElement>, "className" | "title"> & {
  title?: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  headingId?: string;
  spacing?: Spacing;
  scrollTarget?: boolean;
  header?: "visible" | "hidden";
  className?: string;
};

export function ContentSection({
  title,
  eyebrow,
  description,
  actions,
  headingId,
  spacing = "normal",
  scrollTarget = false,
  header = "visible",
  className,
  children,
  ...props
}: ContentSectionProps) {
  const hasHeader = header === "visible" && (title || eyebrow || description || actions);
  return (
    <section
      className={cn("ui-content-section", scrollTarget && "ui-sticky-scroll-target", className)}
      data-spacing={spacing}
      aria-labelledby={title && headingId ? headingId : undefined}
      {...props}
    >
      {hasHeader && (
        <SectionHeader>
          <SectionHeaderContent>
            {eyebrow && <p className="ui-section-header-eyebrow">{eyebrow}</p>}
            {title && <SectionHeaderTitle id={headingId}>{title}</SectionHeaderTitle>}
            {description && <SectionHeaderDescription>{description}</SectionHeaderDescription>}
          </SectionHeaderContent>
          {actions && <SectionHeaderActions>{actions}</SectionHeaderActions>}
        </SectionHeader>
      )}
      {children}
    </section>
  );
}
