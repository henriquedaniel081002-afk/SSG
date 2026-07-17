import React from 'react';

export interface AppShellProps {
  navigation: React.ReactNode;
  topbar: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function AppShell({ navigation, topbar, footer, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background text-text-primary md:flex">
      {navigation}
      <div className="min-w-0 flex-1">
        {topbar}
        <main className="mx-auto min-h-[calc(100vh-8rem)] w-full max-w-[1600px] p-4 sm:p-5 md:p-6 xl:p-8">
          {children}
        </main>
        {footer}
      </div>
    </div>
  );
}
