"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import * as XLSX from "xlsx";

const CLAVE_ADMIN = "tatiprofe";

type EntregaAdmin = {
  id: string;
  nombre: string | null;
  apellido: string | null;
  numero_estudiante: string | null;
  email: string | null;
  titulo: string | null;
  descripcion: string | null;
  estado: string | null;
  calificacion: number | null;
  respuesta_docente: string | null;
  fecha_entrega: string | null;
  created_at: string | null;
  grupo_nombre: string | null;
  entregable_titulo: string | null;
  fecha_limite: string | null;
  tipo_entrega: string | null;
};

type ArchivoEntrega = {
  id: string;
  entrega_id: string;
  nombre_archivo: string;
  ruta_archivo: string;
  tipo_archivo: string | null;
  tamano_bytes: number | null;
};

export default function AdminEntregasPage() {
  const [autorizado, setAutorizado] = useState(false);
  const [clave, setClave] = useState("");
  const [errorClave, setErrorClave] = useState("");
  const [entregas, setEntregas] = useState<EntregaAdmin[]>([]);
  const [archivos, setArchivos] = useState<ArchivoEntrega[]>([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [filtroAlumno, setFiltroAlumno] = useState("");
  const [filtroGrupo, setFiltroGrupo] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");

  async function cargarEntregas() {
    setLoading(true);
    setErrorMsg("");

    const [entregasRes, archivosRes] = await Promise.all([
      supabase.from("vista_entregas_admin").select("*").order("fecha_entrega", { ascending: false }),
      supabase.from("archivos_entrega").select("*").order("created_at", { ascending: false }),
    ]);

    if (entregasRes.error) {
      setErrorMsg(entregasRes.error.message);
    } else {
      setEntregas((entregasRes.data || []) as EntregaAdmin[]);
    }

    if (archivosRes.error) {
      setErrorMsg((prev) => prev || archivosRes.error.message);
    } else {
      setArchivos((archivosRes.data || []) as ArchivoEntrega[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (autorizado) {
      cargarEntregas();
    }
  }, [autorizado]);

  function entrarAdmin() {
    if (clave !== CLAVE_ADMIN) {
      setErrorClave("Contraseña incorrecta.");
      return;
    }
    setAutorizado(true);
    setErrorClave("");
  }

  async function guardarCorreccion(
    id: string,
    calificacion: string,
    respuesta_docente: string,
    estado: string
  ) {
    setMensaje("");
    setErrorMsg("");

    const nota = calificacion === "" ? null : Number(calificacion);

    const { error } = await supabase
      .from("entregas")
      .update({
        calificacion: nota,
        respuesta_docente,
        estado,
      })
      .eq("id", id);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    setMensaje("Corrección guardada.");
    await cargarEntregas();
  }

  async function verArchivo(rutaArchivo: string, nombreArchivo: string) {
    setMensaje("");
    setErrorMsg("");

    const { data, error } = await supabase.storage
      .from("entregas")
      .createSignedUrl(rutaArchivo, 60 * 10);

    if (error || !data?.signedUrl) {
      setErrorMsg(error?.message || "No se pudo generar el acceso al archivo.");
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  const gruposUnicos = useMemo(() => {
    return Array.from(
      new Set(entregas.map((e) => e.grupo_nombre).filter(Boolean))
    ) as string[];
  }, [entregas]);

  const filtradas = useMemo(() => {
    return entregas.filter((e) => {
      const alumno =
        `${e.nombre || ""} ${e.apellido || ""} ${e.numero_estudiante || ""}`.toLowerCase();
      const matchAlumno = alumno.includes(filtroAlumno.toLowerCase());
      const matchGrupo = !filtroGrupo || e.grupo_nombre === filtroGrupo;
      const matchEstado = !filtroEstado || e.estado === filtroEstado;
      return matchAlumno && matchGrupo && matchEstado;
    });
  }, [entregas, filtroAlumno, filtroGrupo, filtroEstado]);

  const resumenPorAlumno = useMemo(() => {
    const mapa = new Map<
      string,
      {
        alumno: string;
        grupo: string;
        cantidad: number;
        suma: number;
        conNota: number;
        promedio: number;
      }
    >();

    for (const e of filtradas) {
      const key = `${e.numero_estudiante || ""}-${e.grupo_nombre || ""}`;

      if (!mapa.has(key)) {
        mapa.set(key, {
          alumno: `${e.nombre || ""} ${e.apellido || ""}`.trim(),
          grupo: e.grupo_nombre || "",
          cantidad: 0,
          suma: 0,
          conNota: 0,
          promedio: 0,
        });
      }

      const item = mapa.get(key)!;
      item.cantidad += 1;

      if (typeof e.calificacion === "number") {
        item.suma += e.calificacion;
        item.conNota += 1;
      }
    }

    for (const item of mapa.values()) {
      item.promedio =
        item.conNota > 0
          ? Number((item.suma / item.conNota).toFixed(2))
          : 0;
    }

    return Array.from(mapa.values());
  }, [filtradas]);

  function exportarExcel() {
    const data = filtradas.map((e) => ({
      Nombre: e.nombre || "",
      Apellido: e.apellido || "",
      NumeroEstudiante: e.numero_estudiante || "",
      Email: e.email || "",
      Grupo: e.grupo_nombre || "",
      Entregable: e.entregable_titulo || "",
      Estado: e.estado || "",
      Calificacion: e.calificacion ?? "",
      RespuestaDocente: e.respuesta_docente || "",
      FechaEntrega: e.fecha_entrega || "",
      FechaLimite: e.fecha_limite || "",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Entregas");

    const resumen = XLSX.utils.json_to_sheet(
      resumenPorAlumno.map((r) => ({
        Alumno: r.alumno,
        Grupo: r.grupo,
        CantidadEntregas: r.cantidad,
        Promedio: r.promedio,
      }))
    );
    XLSX.utils.book_append_sheet(wb, resumen, "Promedios");

    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "entregas_admin.xlsx";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }

  if (!autorizado) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,#fff7fb_0%,#f8f7ff_45%,#eef2ff_100%)] p-8">
        <div className="mx-auto max-w-xl rounded-[32px] border border-white/70 bg-white/85 p-8 shadow">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.16em] text-fuchsia-500">
                Acceso admin
              </p>
              <h1 className="mt-2 text-3xl font-semibold">Panel de entregas</h1>
            </div>

            <a
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Volver a inicio
            </a>
          </div>

          <p className="mt-2 text-slate-600">
            Ingresá la contraseña para ver entregas, corregir y exportar a Excel.
          </p>

          <div className="mt-6 space-y-4">
            <input
              type="password"
              value={clave}
              onChange={(e) => {
                setClave(e.target.value);
                setErrorClave("");
              }}
              placeholder="Contraseña admin"
              className="h-12 w-full rounded-2xl border border-slate-200 px-4 outline-none focus:border-fuchsia-300"
            />

            {errorClave && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
                {errorClave}
              </div>
            )}

            <button
              type="button"
              onClick={entrarAdmin}
              className="h-12 rounded-2xl bg-[linear-gradient(90deg,#ec4899_0%,#a855f7_100%)] px-6 text-white"
            >
              Entrar
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fff7fb_0%,#f8f7ff_45%,#eef2ff_100%)] p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-[32px] border border-white/70 bg-white/85 p-8 shadow">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.16em] text-fuchsia-500">
                Admin
              </p>
              <h1 className="mt-2 text-3xl font-semibold">Entregas recibidas</h1>
              <p className="mt-2 text-slate-600">
                Filtrá, corregí, puntuá, abrí archivos y exportá la información.
              </p>
            </div>

            <div className="flex gap-3">
              <a
                href="/"
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 text-slate-700"
              >
                Volver a inicio
              </a>

              <button
                type="button"
                onClick={exportarExcel}
                className="h-12 rounded-2xl bg-[linear-gradient(90deg,#ec4899_0%,#a855f7_100%)] px-6 text-white"
              >
                Llevar a Excel
              </button>
            </div>
          </div>
        </div>

        {mensaje && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
            {mensaje}
          </div>
        )}

        {errorMsg && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            {errorMsg}
          </div>
        )}

        <div className="rounded-[32px] border border-white/70 bg-white/85 p-6 shadow">
          <div className="grid gap-4 md:grid-cols-3">
            <input
              value={filtroAlumno}
              onChange={(e) => setFiltroAlumno(e.target.value)}
              placeholder="Filtrar por alumno o número"
              className="h-12 rounded-2xl border border-slate-200 px-4 outline-none focus:border-fuchsia-300"
            />

            <select
              value={filtroGrupo}
              onChange={(e) => setFiltroGrupo(e.target.value)}
              className="h-12 rounded-2xl border border-slate-200 px-4 outline-none focus:border-fuchsia-300"
            >
              <option value="">Todos los grupos</option>
              {gruposUnicos.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>

            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="h-12 rounded-2xl border border-slate-200 px-4 outline-none focus:border-fuchsia-300"
            >
              <option value="">Todos los estados</option>
              <option value="recibido">recibido</option>
              <option value="en corrección">en corrección</option>
              <option value="aprobado">aprobado</option>
              <option value="rehacer">rehacer</option>
            </select>
          </div>
        </div>

        <div className="rounded-[32px] border border-white/70 bg-white/85 p-6 shadow">
          <h2 className="text-2xl font-semibold">Promedios por alumno y grupo</h2>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="py-3">Alumno</th>
                  <th className="py-3">Grupo</th>
                  <th className="py-3">Entregas</th>
                  <th className="py-3">Promedio</th>
                </tr>
              </thead>
              <tbody>
                {resumenPorAlumno.map((r, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-3">{r.alumno}</td>
                    <td className="py-3">{r.grupo}</td>
                    <td className="py-3">{r.cantidad}</td>
                    <td className="py-3">{r.promedio}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-[32px] border border-white/70 bg-white/85 p-6 shadow">
          <h2 className="text-2xl font-semibold">Entregas</h2>

          {loading ? (
            <p className="mt-4 text-slate-500">Cargando...</p>
          ) : (
            <div className="mt-5 space-y-5">
              {filtradas.length === 0 ? (
                <p className="text-slate-500">No hay entregas para mostrar.</p>
              ) : (
                filtradas.map((e) => {
                  const archivosDeEntrega = archivos.filter(
                    (a) => a.entrega_id === e.id
                  );

                  return (
                    <EntregaCard
                      key={e.id}
                      entrega={e}
                      archivos={archivosDeEntrega}
                      onGuardar={guardarCorreccion}
                      onVerArchivo={verArchivo}
                    />
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function EntregaCard({
  entrega,
  archivos,
  onGuardar,
  onVerArchivo,
}: {
  entrega: EntregaAdmin;
  archivos: ArchivoEntrega[];
  onGuardar: (
    id: string,
    calificacion: string,
    respuesta: string,
    estado: string
  ) => Promise<void>;
  onVerArchivo: (rutaArchivo: string, nombreArchivo: string) => Promise<void>;
}) {
  const [calificacion, setCalificacion] = useState(
    entrega.calificacion?.toString() || ""
  );
  const [respuesta, setRespuesta] = useState(entrega.respuesta_docente || "");
  const [estado, setEstado] = useState(entrega.estado || "recibido");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="font-semibold text-slate-900">
            {entrega.nombre} {entrega.apellido}
          </p>
          <p className="text-sm text-slate-500">
            {entrega.numero_estudiante} · {entrega.email}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            <span className="font-medium">Grupo:</span>{" "}
            {entrega.grupo_nombre || "-"}
          </p>
          <p className="text-sm text-slate-600">
            <span className="font-medium">Entregable:</span>{" "}
            {entrega.entregable_titulo || entrega.titulo || "-"}
          </p>
          <p className="text-sm text-slate-600">
            <span className="font-medium">Fecha entrega:</span>{" "}
            {entrega.fecha_entrega
              ? new Date(entrega.fecha_entrega).toLocaleString("es-UY")
              : "-"}
          </p>
          <p className="text-sm text-slate-600">
            <span className="font-medium">Vencimiento:</span>{" "}
            {entrega.fecha_limite
              ? new Date(entrega.fecha_limite).toLocaleString("es-UY")
              : "-"}
          </p>

          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium text-slate-700">Archivos del alumno</p>

            {archivos.length === 0 ? (
              <p className="text-sm text-slate-500">No hay archivo adjunto.</p>
            ) : (
              archivos.map((archivo) => (
                <button
                  key={archivo.id}
                  type="button"
                  onClick={() =>
                    onVerArchivo(archivo.ruta_archivo, archivo.nombre_archivo)
                  }
                  className="block rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  Ver archivo: {archivo.nombre_archivo}
                </button>
              ))
            )}
          </div>
        </div>

        <div>
          <textarea
            value={respuesta}
            onChange={(e) => setRespuesta(e.target.value)}
            placeholder="Devolución docente"
            className="min-h-[100px] w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-fuchsia-300"
          />
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[160px_220px_1fr]">
        <input
          value={calificacion}
          onChange={(e) => setCalificacion(e.target.value)}
          placeholder="Nota"
          className="h-12 rounded-2xl border border-slate-200 px-4 outline-none focus:border-fuchsia-300"
        />

        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          className="h-12 rounded-2xl border border-slate-200 px-4 outline-none focus:border-fuchsia-300"
        >
          <option value="recibido">recibido</option>
          <option value="en corrección">en corrección</option>
          <option value="aprobado">aprobado</option>
          <option value="rehacer">rehacer</option>
        </select>

        <button
          type="button"
          onClick={() => onGuardar(entrega.id, calificacion, respuesta, estado)}
          className="h-12 rounded-2xl bg-[linear-gradient(90deg,#ec4899_0%,#a855f7_100%)] px-6 text-white"
        >
          Guardar corrección
        </button>
      </div>
    </div>
  );
}
