import { Toaster as Sonner } from 'sonner';

const Toaster = () => (
  <Sonner
    theme="light"
    className="toaster group"
    toastOptions={{
      classNames: {
        toast:
          'group toast group-[.toaster]:bg-white group-[.toaster]:text-slate-950 group-[.toaster]:border-slate-200 group-[.toaster]:shadow-lg',
        description: 'group-[.toast]:text-slate-500',
      },
    }}
  />
);

export { Toaster };
