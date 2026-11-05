import { AdminLayout } from "@/components/layout/AdminLayout";

export default function RoutesLoading() {
  return (
    <AdminLayout>
      <div className="min-h-screen bg-slate-100">
        <header className="border-b border-slate-200 bg-white px-8 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-normal text-slate-950">
                Rotas
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Histórico de rotas da frota municipal
              </p>
            </div>
          </div>
        </header>

        <div className="p-8">
          <section className="rounded-lg border border-slate-200 bg-white p-10 text-center shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Carregando rotas...
            </p>
          </section>
        </div>
      </div>
    </AdminLayout>
  );
}
