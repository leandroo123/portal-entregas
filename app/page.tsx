"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";

type Noticia = {
  id: string;
  titulo: string;
  contenido: string;
  publicada: boolean;
};

type Grupo = {
  id: string;
  nombre: string;
  descripcion: string | null;
};

type Entregable = {
  id: string;
  titulo: string;
  descripcion: string | null;
  fecha_limite: string | null;
  tipo_entrega: string;
  publicado: boolean;
};

type Vista = "alumno" | "admin";

const CLAVE_ADMIN = "tatiprofe";

export default function Home() {
  const [vista, setVista] = useState<Vista>("alumno");
  const [adminAutorizado, setAdminAutorizado] = useState(false);
  const [claveAccesoAdmin, setClaveAccesoAdmin] = useState("");
  const [errorAccesoAdmin, setErrorAccesoAdmin] = useState("");

  const [noticias, setNoticias] = useState<Noticia[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [entregables, setEntregables] = useState<Entregable[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);

  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    numero_estudiante: "",
    email: "",
    grupo_id: "",
    entregable_id: "",
    descripcion: "",
  });

  const [adminEntregable, setAdminEntregable] = useState({
    titulo: "",
    descripcion: "",
    fecha_limite: "",
    tipo_entrega: "individual",
    grupo_id: "",
    publicado: true,
  });

  const entregablesPublicados = useMemo(
    () => entregables.filter((e) => e.publicado),
    [entregables]
  );

  useEffect(() => {
    async function cargarTodo() {
      const [noticiasRes, gruposRes, entregablesRes] = await Promise.all([
        supabase
          .from("noticias")
          .select("*")
          .eq("publicada", true)
          .order("created_at", { ascending: false }),
        supabase.from("grupos").select("*").order("nombre", { ascending: true }),
        supabase.from("entregables").select("*").order("created_at", { ascending: false }),
      ]);

      if (noticiasRes.error) setErrorMsg(noticiasRes.error.message);
      if (gruposRes.error) setErrorMsg(gruposRes.error.message);
      if (entregablesRes.error) setErrorMsg(entregablesRes.error.message);

      setNoticias(noticiasRes.data || []);
      setGrupos(gruposRes.data || []);
      setEntregables(entregablesRes.data || []);
      setLoading(false);
    }

    cargarTodo();
  }, []);

  function irAAdmin() {
    setVista("admin");
    setMensaje("");
    setErrorMsg("");
  }

  function validarAccesoAdmin() {
    if (claveAccesoAdmin === CLAVE_ADMIN) {
      setAdminAutorizado(true);
      setErrorAccesoAdmin("");
    } else {
      setAdminAutorizado(false);
      setErrorAccesoAdmin("La contraseña de admin es incorrecta.");
    }
  }

  function salirAdmin() {
    setAdminAutorizado(false);
    setClaveAccesoAdmin("");
    setErrorAccesoAdmin("");
    setVista("alumno");
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setArchivo(file);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMensaje("");
    setErrorMsg("");

    if (
      !form.nombre ||
      !form.apellido ||
      !form.numero_estudiante ||
      !form.email ||
      !form.grupo_id ||
      !form.entregable_id
    ) {
      setErrorMsg("Completá todos los campos obligatorios.");
      return;
    }

    const entregableSeleccionado = entregablesPublicados.find(
      (x) => x.id === form.entregable_id
    );

    if (!entregableSeleccionado) {
      setErrorMsg("Seleccioná un entregable válido.");
      return;
    }

    if (
      entregableSeleccionado.fecha_limite &&
      new Date() > new Date(entregableSeleccionado.fecha_limite)
    ) {
      setErrorMsg("Este entregable ya venció y no admite nuevas entregas.");
      return;
    }

    setGuardando(true);

    const { data: entregaData, error: entregaError } = await supabase
      .from("entregas")
      .insert({
        nombre: form.nombre,
        apellido: form.apellido,
        numero_estudiante: form.numero_estudiante,
        email: form.email,
        grupo_id: form.grupo_id,
        entregable_id: form.entregable_id,
        titulo: entregableSeleccionado.titulo || "Entrega académica",
        descripcion: form.descripcion,
        estado: "recibido",
      })
      .select()
      .single();

    if (entregaError) {
      setErrorMsg(entregaError.message);
      setGuardando(false);
      return;
    }

    if (archivo && entregaData) {
      const safeName = archivo.name.replace(/\s+/g, "-");
      const filePath = Date.now() + "-" + safeName;

      const { error: uploadError } = await supabase.storage
        .from("entregas")
        .upload(filePath, archivo);

      if (uploadError) {
        setErrorMsg(
          "La entrega se guardó, pero el archivo no se pudo subir: " +
            uploadError.message
        );
        setGuardando(false);
        return;
      }

      const extension = archivo.name.split(".").pop();

      const { error: archivoError } = await supabase
        .from("archivos_entrega")
        .insert({
          entrega_id: entregaData.id,
          nombre_archivo: archivo.name,
          ruta_archivo: filePath,
          tipo_archivo: extension || archivo.type || null,
          tamano_bytes: archivo.size,
        });

      if (archivoError) {
        setErrorMsg(
          "La entrega se guardó, pero no se pudo registrar el archivo: " +
            archivoError.message
        );
        setGuardando(false);
        return;
      }
    }

    setMensaje("Entrega enviada correctamente.");
    setForm({
      nombre: "",
      apellido: "",
      numero_estudiante: "",
      email: "",
      grupo_id: "",
      entregable_id: "",
      descripcion: "",
    });
    setArchivo(null);
    setGuardando(false);
  }

  async function handleCrearEntregable(e: FormEvent) {
    e.preventDefault();
    setMensaje("");
    setErrorMsg("");

    if (!adminAutorizado) {
      setErrorMsg("Necesitás entrar con contraseña para usar el panel admin.");
      return;
    }

    if (!adminEntregable.titulo || !adminEntregable.grupo_id) {
      setErrorMsg("Para crear un entregable cargá al menos título y grupo.");
      return;
    }

    setGuardando(true);

    const { data: entregableCreado, error: entregableError } = await supabase
      .from("entregables")
      .insert({
        titulo: adminEntregable.titulo,
        descripcion: adminEntregable.descripcion,
        fecha_limite: adminEntregable.fecha_limite || null,
        tipo_entrega: adminEntregable.tipo_entrega,
        publicado: adminEntregable.publicado,
      })
      .select()
      .single();

    if (entregableError || !entregableCreado) {
      setErrorMsg(entregableError?.message || "No se pudo crear el entregable.");
      setGuardando(false);
      return;
    }

    const { error: grupoError } = await supabase.from("entregables_grupos").insert({
      entregable_id: entregableCreado.id,
      grupo_id: adminEntregable.grupo_id,
    });

    if (grupoError) {
      setErrorMsg(
        "El entregable se creó, pero no se pudo asignar al grupo: " +
          grupoError.message
      );
      setGuardando(false);
      return;
    }

    setEntregables((prev) => [entregableCreado, ...prev]);

    setAdminEntregable({
      titulo: "",
      descripcion: "",
      fecha_limite: "",
      tipo_entrega: "individual",
      grupo_id: "",
      publicado: true,
    });

    setMensaje(
      entregableCreado.publicado
        ? "Entregable creado y publicado."
        : "Entregable creado como borrador."
    );

    setGuardando(false);
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fff7fb_0%,#f8f7ff_45%,#eef2ff_100%)] text-slate-900">
      <section className="mx-auto max-w-7xl px-6 py-10 md:px-10 md:py-14">
        <div className="overflow-hidden rounded-[38px] border border-white/70 bg-white/80 shadow-[0_12px_40px_rgba(88,72,120,0.10)] backdrop-blur">
          <div className="grid gap-8 p-8 md:p-12 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <span className="inline-flex rounded-full border border-fuchsia-100 bg-fuchsia-50 px-4 py-1.5 text-xs font-semibold text-fuchsia-700">
                IA aplicada a Marketing
              </span>
              <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight text-slate-900 md:text-6xl">
                Portal académico de Tatiana Loitey
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 md:text-lg">
                Plataforma para gestionar grupos, clases, entregables, archivos, comunicación y devoluciones.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href="/"
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Inicio
                </a>
                <a
                  href="/alumno/correcciones"
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Mis correcciones
                </a>
                <a
                  href="/admin/entregas"
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Admin entregas
                </a>
              </div>
            </div>

            <div className="rounded-[30px] border border-fuchsia-100 bg-[linear-gradient(180deg,#db2777_0%,#a855f7_55%,#6d28d9_100%)] p-6 text-white shadow-[0_10px_30px_rgba(109,40,217,0.25)] md:p-8">
              <p className="text-sm uppercase tracking-[0.18em] text-fuchsia-100">Profesora</p>
              <h2 className="mt-3 text-3xl font-semibold">Tatiana Loitey</h2>
              <p className="mt-4 text-sm leading-6 text-fuchsia-100">
                Vista alumno y acceso admin con contraseña.
              </p>

              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={() => setVista("alumno")}
                  className={
                    "rounded-2xl px-4 py-2 text-sm font-medium transition " +
                    (vista === "alumno" ? "bg-white text-fuchsia-700" : "bg-white/10 text-white")
                  }
                >
                  Vista alumno
                </button>

                <button
                  type="button"
                  onClick={irAAdmin}
                  className={
                    "rounded-2xl px-4 py-2 text-sm font-medium transition " +
                    (vista === "admin" ? "bg-white text-fuchsia-700" : "bg-white/10 text-white")
                  }
                >
                  Admin
                </button>
              </div>
            </div>
          </div>
        </div>

        {mensaje && (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
            {mensaje}
          </div>
        )}

        {errorMsg && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            {errorMsg}
          </div>
        )}

        {vista === "alumno" ? (
          <div className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[32px] border border-white/70 bg-white/85 p-6 shadow-[0_10px_35px_rgba(88,72,120,0.08)] backdrop-blur md:p-8">
              <div className="mb-6">
                <p className="text-sm font-medium uppercase tracking-[0.16em] text-fuchsia-500">
                  Entrega académica
                </p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight">Subí tu trabajo</h2>
                <p className="mt-2 text-slate-600">
                  Elegí tu grupo, seleccioná el entregable publicado y adjuntá tu archivo.
                </p>
              </div>

              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="grid gap-4 md:grid-cols-2">
                  <input
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 outline-none transition focus:border-fuchsia-300 focus:ring-4 focus:ring-fuchsia-100"
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    placeholder="Nombre"
                  />
                  <input
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 outline-none transition focus:border-fuchsia-300 focus:ring-4 focus:ring-fuchsia-100"
                    value={form.apellido}
                    onChange={(e) => setForm({ ...form, apellido: e.target.value })}
                    placeholder="Apellido"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <input
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 outline-none transition focus:border-fuchsia-300 focus:ring-4 focus:ring-fuchsia-100"
                    value={form.numero_estudiante}
                    onChange={(e) => setForm({ ...form, numero_estudiante: e.target.value })}
                    placeholder="Número de estudiante"
                  />
                  <input
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 outline-none transition focus:border-fuchsia-300 focus:ring-4 focus:ring-fuchsia-100"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="Mail"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <select
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 outline-none transition focus:border-fuchsia-300 focus:ring-4 focus:ring-fuchsia-100"
                    value={form.grupo_id}
                    onChange={(e) => setForm({ ...form, grupo_id: e.target.value })}
                  >
                    <option value="">Seleccionar grupo</option>
                    {grupos.map((grupo) => (
                      <option key={grupo.id} value={grupo.id}>
                        {grupo.nombre}
                      </option>
                    ))}
                  </select>

                  <select
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 outline-none transition focus:border-fuchsia-300 focus:ring-4 focus:ring-fuchsia-100"
                    value={form.entregable_id}
                    onChange={(e) => setForm({ ...form, entregable_id: e.target.value })}
                  >
                    <option value="">Seleccionar entregable</option>
                    {entregablesPublicados.map((entregable) => (
                      <option key={entregable.id} value={entregable.id}>
                        {entregable.titulo}
                      </option>
                    ))}
                  </select>
                </div>

                <textarea
                  className="min-h-[130px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-fuchsia-300 focus:ring-4 focus:ring-fuchsia-100"
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  placeholder="Descripción o comentario"
                />

                <label className="flex cursor-pointer flex-col items-center justify-center rounded-[28px] border-2 border-dashed border-fuchsia-200 bg-fuchsia-50/40 px-6 py-10 text-center transition hover:border-fuchsia-300 hover:bg-fuchsia-50/70">
                  <span className="text-base font-medium text-slate-800">
                    Hacé clic para seleccionar tu archivo
                  </span>
                  <span className="mt-2 text-sm text-slate-500">
                    PDF, Word, imagen o presentación
                  </span>
                  <input type="file" className="hidden" onChange={handleFileChange} />
                  {archivo && (
                    <span className="mt-4 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm">
                      {archivo.name}
                    </span>
                  )}
                </label>

                <button
                  type="submit"
                  disabled={guardando}
                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-[linear-gradient(90deg,#ec4899_0%,#a855f7_100%)] px-6 font-medium text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
                >
                  {guardando ? "Enviando..." : "Enviar entrega"}
                </button>
              </form>
            </div>

            <div className="space-y-6">
              <div className="rounded-[32px] border border-white/70 bg-white/85 p-6 shadow-[0_10px_35px_rgba(88,72,120,0.08)] backdrop-blur md:p-8">
                <h3 className="text-2xl font-semibold">Trabajos publicados</h3>
                <div className="mt-5 space-y-4">
                  {loading ? (
                    <p className="text-slate-500">Cargando...</p>
                  ) : entregablesPublicados.length === 0 ? (
                    <p className="text-slate-500">No hay entregables publicados.</p>
                  ) : (
                    entregablesPublicados.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-fuchsia-100 bg-fuchsia-50/50 p-5">
                        <h4 className="text-lg font-semibold text-slate-900">{item.titulo}</h4>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {item.descripcion || "Sin descripción"}
                        </p>
                        <p className="mt-3 text-xs font-medium text-slate-500">
                          Vence: {item.fecha_limite ? new Date(item.fecha_limite).toLocaleString("es-UY") : "Sin fecha"}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : !adminAutorizado ? (
          <div className="mt-8 mx-auto max-w-xl rounded-[32px] border border-white/70 bg-white/85 p-8 shadow-[0_10px_35px_rgba(88,72,120,0.08)] backdrop-blur">
            <p className="text-sm font-medium uppercase tracking-[0.16em] text-fuchsia-500">
              Acceso admin
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">
              Ingresar al panel docente
            </h2>
            <p className="mt-2 text-slate-600">
              Para entrar al panel de Tatiana, ingresá la contraseña.
            </p>

            <div className="mt-6 space-y-4">
              <input
                type="password"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 outline-none transition focus:border-fuchsia-300 focus:ring-4 focus:ring-fuchsia-100"
                value={claveAccesoAdmin}
                onChange={(e) => {
                  setClaveAccesoAdmin(e.target.value);
                  setErrorAccesoAdmin("");
                }}
                placeholder="Contraseña admin"
              />

              {errorAccesoAdmin && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
                  {errorAccesoAdmin}
                </div>
              )}

              <button
                type="button"
                onClick={validarAccesoAdmin}
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-[linear-gradient(90deg,#ec4899_0%,#a855f7_100%)] px-6 font-medium text-white shadow-sm transition hover:opacity-95"
              >
                Entrar a admin
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_1fr]">
            <div className="rounded-[32px] border border-white/70 bg-white/85 p-6 shadow-[0_10px_35px_rgba(88,72,120,0.08)] backdrop-blur md:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.16em] text-fuchsia-500">
                    Panel docente
                  </p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                    Crear entregable
                  </h2>
                </div>

                <div className="flex gap-2">
                  <a
                    href="/admin/entregas"
                    className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Ver entregas
                  </a>
                  <button
                    type="button"
                    onClick={salirAdmin}
                    className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Salir
                  </button>
                </div>
              </div>

              <p className="mt-2 text-slate-600">
                Tatiana puede crear entregables desde la web y decidir si quedan publicados o en borrador.
              </p>

              <form className="mt-6 space-y-5" onSubmit={handleCrearEntregable}>
                <input
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 outline-none transition focus:border-fuchsia-300 focus:ring-4 focus:ring-fuchsia-100"
                  value={adminEntregable.titulo}
                  onChange={(e) => setAdminEntregable({ ...adminEntregable, titulo: e.target.value })}
                  placeholder="Título del entregable"
                />

                <textarea
                  className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-fuchsia-300 focus:ring-4 focus:ring-fuchsia-100"
                  value={adminEntregable.descripcion}
                  onChange={(e) => setAdminEntregable({ ...adminEntregable, descripcion: e.target.value })}
                  placeholder="Descripción o consigna"
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <select
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 outline-none transition focus:border-fuchsia-300 focus:ring-4 focus:ring-fuchsia-100"
                    value={adminEntregable.grupo_id}
                    onChange={(e) => setAdminEntregable({ ...adminEntregable, grupo_id: e.target.value })}
                  >
                    <option value="">Seleccionar grupo</option>
                    {grupos.map((grupo) => (
                      <option key={grupo.id} value={grupo.id}>
                        {grupo.nombre}
                      </option>
                    ))}
                  </select>

                  <select
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 outline-none transition focus:border-fuchsia-300 focus:ring-4 focus:ring-fuchsia-100"
                    value={adminEntregable.tipo_entrega}
                    onChange={(e) => setAdminEntregable({ ...adminEntregable, tipo_entrega: e.target.value })}
                  >
                    <option value="individual">Individual</option>
                    <option value="grupal">Grupal</option>
                  </select>
                </div>

                <input
                  type="datetime-local"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 outline-none transition focus:border-fuchsia-300 focus:ring-4 focus:ring-fuchsia-100"
                  value={adminEntregable.fecha_limite}
                  onChange={(e) => setAdminEntregable({ ...adminEntregable, fecha_limite: e.target.value })}
                />

                <label className="flex items-center gap-3 rounded-2xl border border-fuchsia-100 bg-fuchsia-50/50 p-4 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={adminEntregable.publicado}
                    onChange={(e) => setAdminEntregable({ ...adminEntregable, publicado: e.target.checked })}
                  />
                  Publicar ahora. Si no, queda como borrador.
                </label>

                <button
                  type="submit"
                  disabled={guardando}
                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-[linear-gradient(90deg,#ec4899_0%,#a855f7_100%)] px-6 font-medium text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
                >
                  {guardando ? "Guardando..." : "Crear entregable"}
                </button>
              </form>
            </div>

            <div className="rounded-[32px] border border-white/70 bg-white/85 p-6 shadow-[0_10px_35px_rgba(88,72,120,0.08)] backdrop-blur md:p-8">
              <h3 className="text-2xl font-semibold">Entregables creados</h3>
              <div className="mt-5 space-y-4">
                {loading ? (
                  <p className="text-slate-500">Cargando...</p>
                ) : entregables.length === 0 ? (
                  <p className="text-slate-500">No hay entregables creados.</p>
                ) : (
                  entregables.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-violet-100 bg-violet-50/60 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-lg font-semibold text-slate-900">{item.titulo}</h4>
                          <p className="mt-1 text-sm text-slate-600">
                            {item.descripcion || "Sin descripción"}
                          </p>
                        </div>
                        <span
                          className={
                            "rounded-full px-3 py-1 text-xs font-medium shadow-sm " +
                            (item.publicado
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700")
                          }
                        >
                          {item.publicado ? "Publicado" : "Borrador"}
                        </span>
                      </div>
                      <p className="mt-3 text-xs font-medium text-slate-500">
                        Vence: {item.fecha_limite ? new Date(item.fecha_limite).toLocaleString("es-UY") : "Sin fecha"}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
