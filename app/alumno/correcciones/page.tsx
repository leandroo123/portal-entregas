"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";

type EntregaAlumno = {
  id: string;
  nombre: string | null;
  apellido: string | null;
  numero_estudiante: string | null;
  email: string | null;
  estado: string | null;
  calificacion: number | null;
  respuesta_docente: string | null;
  fecha_entrega: string | null;
  descripcion: string | null;
  grupo_nombre: string | null;
  entregable_titulo: string | null;
  fecha_limite: string | null;
};

export default function CorreccionesAlumnoPage() {
  const [email, setEmail] = useState("");
  const [numero, setNumero] = useState("");
  const [entregas, setEntregas] = useState<EntregaAlumno[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function buscar() {
    setLoading(true);
    setErrorMsg("");

    if (!email || !numero) {
      setErrorMsg("Ingresá correo electrónico y número de estudiante.");
      setEntregas([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("vista_entregas_alumno")
      .select("*")
      .eq("email", email)
      .eq("numero_estudiante", numero)
      .order("fecha_entrega", { ascending: false });

    if (error) {
      setErrorMsg(error.message);
      setEntregas([]);
    } else {
      setEntregas((data || []) as EntregaAlumno[]);
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fff7fb_0%,#f8f7ff_45%,#eef2ff_100%)] p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-[32px] border border-white/70 bg-white/85 p-8 shadow">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.16em] text-fuchsia-500">
                Alumno
              </p>
              <h1 className="mt-2 text-3xl font-semibold">Mis correcciones</h1>
              <p className="mt-2 text-slate-600">
                Ingresá tu mail y número de estudiante para ver tus entregas, notas y devoluciones.
              </p>
            </div>

            <a
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Volver a inicio
            </a>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-[1fr_1fr_auto]">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Correo electrónico"
              className="h-12 rounded-2xl border border-slate-200 px-4 outline-none focus:border-fuchsia-300"
            />
            <input
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="Número de estudiante"
              className="h-12 rounded-2xl border border-slate-200 px-4 outline-none focus:border-fuchsia-300"
            />
            <button
              type="button"
              onClick={buscar}
              className="h-12 rounded-2xl bg-[linear-gradient(90deg,#ec4899_0%,#a855f7_100%)] px-6 text-white"
            >
              Buscar
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            {errorMsg}
          </div>
        )}

        <div className="rounded-[32px] border border-white/70 bg-white/85 p-6 shadow">
          {loading ? (
            <p className="text-slate-500">Buscando...</p>
          ) : entregas.length === 0 ? (
            <p className="text-slate-500">Todavía no hay resultados para mostrar.</p>
          ) : (
            <div className="space-y-4">
              {entregas.map((e) => (
                <div key={e.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        {e.entregable_titulo || "Entrega"}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        Grupo: {e.grupo_nombre || "-"}
                      </p>
                      <p className="text-sm text-slate-600">
                        Fecha de entrega: {e.fecha_entrega ? new Date(e.fecha_entrega).toLocaleString("es-UY") : "-"}
                      </p>
                      <p className="text-sm text-slate-600">
                        Vencimiento: {e.fecha_limite ? new Date(e.fecha_limite).toLocaleString("es-UY") : "-"}
                      </p>
                    </div>

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                      {e.estado || "sin estado"}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl bg-fuchsia-50/50 p-4">
                      <p className="text-sm text-slate-500">Calificación</p>
                      <p className="mt-1 text-2xl font-semibold text-slate-900">
                        {e.calificacion ?? "-"}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-violet-50/50 p-4">
                      <p className="text-sm text-slate-500">Devolución docente</p>
                      <p className="mt-1 text-sm leading-6 text-slate-700">
                        {e.respuesta_docente || "Todavía no hay devolución."}
                      </p>
                    </div>
                  </div>

                  {e.descripcion && (
                    <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                      <p className="text-sm text-slate-500">Comentario del alumno</p>
                      <p className="mt-1 text-sm leading-6 text-slate-700">{e.descripcion}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
