export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-semibold">
            B
          </div>
          <span className="text-lg font-semibold tracking-tight">BoilerTech</span>
        </div>
        {children}
      </div>
    </div>
  );
}
