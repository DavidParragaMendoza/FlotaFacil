"use client";

import { AdminLayout } from "@/components/layout/AdminLayout";

type VehiclesErrorProps = {
  reset: () => void;
};

export default function VehiclesError({ reset }: VehiclesErrorProps) {
  return (
    <AdminLayout>
      <div className="min-h-screen bg-slate-100">
        <header className="border-b border-slate-200 bg-white px-8 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-normal text-slate-950">
                Veículos
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Gerenciamento da frota municipal
              </p>
            </div>
          </div>
        </header>

        <div className="p-8">
          <section className="rounded-lg border border-slate-200 bg-white p-10 text-center shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Não foi possível carregar os veículos. Verifique se o serviço
              central (core-service) está em execução.
            </p>
            <button
              className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
              onClick={reset}
              type="button"
            >
              Tentar novamente
            </button>
          </section>
        </div>
      </div>
    </AdminLayout>
  );
}
