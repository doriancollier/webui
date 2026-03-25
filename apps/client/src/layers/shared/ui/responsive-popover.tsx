import * as React from 'react';
import { useIsMobile } from '../model';
import { Popover, PopoverTrigger, PopoverContent } from './popover';
import { Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerTitle } from './drawer';
import { cn } from '../lib/utils';

interface ResponsivePopoverContextValue {
  isDesktop: boolean;
}

const ResponsivePopoverContext = React.createContext<ResponsivePopoverContextValue | undefined>(
  undefined
);

/** Read responsive popover context. Throws if used outside a ResponsivePopover. */
function useResponsivePopover(): ResponsivePopoverContextValue {
  const ctx = React.useContext(ResponsivePopoverContext);
  if (!ctx) {
    throw new Error('useResponsivePopover must be used within a <ResponsivePopover>');
  }
  return ctx;
}

interface ResponsivePopoverProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** Renders a Popover on desktop or a bottom Drawer on mobile. */
function ResponsivePopover({ children, ...props }: ResponsivePopoverProps) {
  const isDesktop = !useIsMobile();
  const Comp = isDesktop ? Popover : Drawer;

  const ctxValue = React.useMemo<ResponsivePopoverContextValue>(() => ({ isDesktop }), [isDesktop]);

  return (
    <ResponsivePopoverContext.Provider value={ctxValue}>
      <Comp {...props}>{children}</Comp>
    </ResponsivePopoverContext.Provider>
  );
}
ResponsivePopover.displayName = 'ResponsivePopover';

/** Trigger that opens the responsive popover or drawer. */
function ResponsivePopoverTrigger({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof PopoverTrigger>) {
  const { isDesktop } = useResponsivePopover();
  const Comp = isDesktop ? PopoverTrigger : DrawerTrigger;
  return (
    <Comp className={className} {...props}>
      {children}
    </Comp>
  );
}
ResponsivePopoverTrigger.displayName = 'ResponsivePopoverTrigger';

/** Content panel — Popover on desktop, bottom Drawer on mobile. */
function ResponsivePopoverContent({
  className,
  children,
  side,
  align,
  ...props
}: React.ComponentPropsWithoutRef<typeof PopoverContent> & { side?: string; align?: string }) {
  const { isDesktop } = useResponsivePopover();
  if (isDesktop) {
    return (
      <PopoverContent
        side={side as 'top' | 'bottom' | 'left' | 'right'}
        align={align as 'start' | 'center' | 'end'}
        className={cn('max-h-[min(70vh,600px)] w-80 overflow-y-auto', className)}
        {...props}
      >
        {children}
      </PopoverContent>
    );
  }
  // Drawer is always full-width — ignore caller's className (which may have
  // width constraints like w-72 intended for the desktop Popover).
  return (
    <DrawerContent className="flex max-h-[90vh] flex-col" {...props}>
      <div className="flex-1 overflow-y-auto px-4 pb-4">{children}</div>
    </DrawerContent>
  );
}
ResponsivePopoverContent.displayName = 'ResponsivePopoverContent';

/** Title shown only in the Drawer variant (mobile). Returns null on desktop. */
function ResponsivePopoverTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  const { isDesktop } = useResponsivePopover();
  if (isDesktop) return null;
  return (
    <DrawerHeader>
      <DrawerTitle className={className} {...props}>
        {children}
      </DrawerTitle>
    </DrawerHeader>
  );
}
ResponsivePopoverTitle.displayName = 'ResponsivePopoverTitle';

export {
  ResponsivePopover,
  ResponsivePopoverTrigger,
  ResponsivePopoverContent,
  ResponsivePopoverTitle,
  useResponsivePopover,
};
