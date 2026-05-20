"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { BACK_URL, getAuthHeaders } from "@/config/api";
// Política de contraseñas y componente visual reutilizable.
// El admin debe poder ver los mismos requisitos que cualquier
// usuario, así no se "queda corto" eligiendo una clave inicial
// que el endpoint del backend luego rechazaría.
import PasswordRequirements from "@/components/PasswordRequirements";
import { passwordCumplePolitica } from "@/utils/passwordPolicy";

const ROL_LABEL = { alumno: "Alumno", docente: "Docente", administrador: "Administrador" };
const ROL_COLOR = {
  alumno:        "bg-blue-100 text-blue-700",
  docente:       "bg-amber-100 text-amber-700",
  administrador: "bg-emerald-100 text-emerald-700",
};

export default function AdminUsuariosPage() {
  return (
    <ProtectedRoute roles={["administrador"]}>
      <AdminContenido />
    </ProtectedRoute>
  );
}

function AdminContenido() {
  const { usuario } = useAuth();

  const [usuarios,     setUsuarios]     = useState([]);
  const [loadingData,  setLoadingData]  = useState(true);
  const [error,        setError]        = useState("");
  const [busqueda,     setBusqueda]     = useState("");
  const [modal,        setModal]        = useState(null);
  const [seleccionado, setSeleccionado] = useState(null);
  const [form,         setForm]         = useState({ dni:"", nombre:"", rol:"alumno", password:"", activo:true });
  const [formError,    setFormError]    = useState("");
  const [formLoading,  setFormLoading]  = useState(false);
  const [formSuccess,  setFormSuccess]  = useState("");

  const cargarUsuarios = useCallback(async () => {
    setLoadingData(true); setError("");
    try {
      const res  = await fetch(`${BACK_URL}/api/auth/usuarios`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setUsuarios(Array.isArray(data) ? data : []);
    } catch (e) { setError(e.message ?? "Error al cargar usuarios."); }
    finally     { setLoadingData(false); }
  }, []);

  useEffect(() => { if (usuario?.rol === "administrador") cargarUsuarios(); }, [usuario, cargarUsuarios]);

  const usuariosFiltrados = usuarios.filter(u =>
    u.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    u.dni?.includes(busqueda) ||
    u.rol?.includes(busqueda.toLowerCase())
  );

  function abrirCrear() {
    setForm({ dni:"", nombre:"", rol:"alumno", password:"", activo:true });
    setFormError(""); setFormSuccess(""); setModal("crear");
  }
  function abrirEditar(u) {
    setSeleccionado(u);
    setForm({ nombre:u.nombre, rol:u.rol, activo:u.activo, password:"" });
    setFormError(""); setFormSuccess(""); setModal("editar");
  }
  function abrirReset(u) {
    setSeleccionado(u); setFormError(""); setFormSuccess(""); setModal("reset");
  }
  function cerrarModal() { setModal(null); setSeleccionado(null); setFormError(""); setFormSuccess(""); }

  async function handleCrear(e) {
    e.preventDefault(); setFormError(""); setFormSuccess("");
    if (!form.dni || !form.nombre || !form.password) return setFormError("Completá todos los campos obligatorios.");
    // Política unificada: la misma que pide el backend.
    if (!passwordCumplePolitica(form.password))
      return setFormError("La contraseña no cumple con los requisitos de seguridad.");
    setFormLoading(true);
    try {
      const res  = await fetch(`${BACK_URL}/api/auth/usuarios`, {
        method:"POST", headers:getAuthHeaders(),
        body:JSON.stringify({ dni:form.dni, nombre:form.nombre, rol:form.rol, password:form.password }),
      });
      const data = await res.json();
      if (!res.ok) return setFormError(data.message);
      setFormSuccess(data.message); await cargarUsuarios(); setTimeout(cerrarModal, 1500);
    } catch { setFormError("Error de red."); }
    finally   { setFormLoading(false); }
  }

  async function handleEditar(e) {
    e.preventDefault(); setFormError(""); setFormSuccess("");
    // Si el admin ingresó una clave nueva (campo opcional en
    // edición), validamos contra la misma política.
    if (form.password && !passwordCumplePolitica(form.password))
      return setFormError("La nueva contraseña no cumple con los requisitos de seguridad.");
    setFormLoading(true);
    try {
      const body = { nombre:form.nombre, rol:form.rol, activo:form.activo };
      if (form.password) body.passwordNueva = form.password;
      const res  = await fetch(`${BACK_URL}/api/auth/usuarios/${seleccionado.usuarioId}`, {
        method:"PUT", headers:getAuthHeaders(), body:JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) return setFormError(data.message);
      setFormSuccess(data.message); await cargarUsuarios(); setTimeout(cerrarModal, 1500);
    } catch { setFormError("Error de red."); }
    finally   { setFormLoading(false); }
  }

  async function handleReset() {
    setFormLoading(true); setFormError(""); setFormSuccess("");
    try {
      const res  = await fetch(`${BACK_URL}/api/auth/usuarios/${seleccionado.usuarioId}/reset`, {
        method:"POST", headers:getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) return setFormError(data.message);
      setFormSuccess(data.message); setTimeout(cerrarModal, 2000);
    } catch { setFormError("Error de red."); }
    finally   { setFormLoading(false); }
  }

  async function handleDesactivar(u) {
    if (!confirm(`¿Desactivar al usuario ${u.nombre}?`)) return;
    try {
      const res  = await fetch(`${BACK_URL}/api/auth/usuarios/${u.usuarioId}`, { method:"DELETE", headers:getAuthHeaders() });
      const data = await res.json();
      if (!res.ok) { alert(data.message); return; }
      await cargarUsuarios();
    } catch { alert("Error de red."); }
  }

  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-200";

  return (
    <div className="flex flex-1 flex-col px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-5xl">

        {/* Encabezado */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800 sm:text-2xl">Gestión de Usuarios</h1>
            <p className="mt-0.5 text-sm text-gray-500">{usuarios.length} usuarios registrados</p>
          </div>
          <button onClick={abrirCrear}
            className="rounded-xl bg-green-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-800 self-start sm:self-auto">
            + Nuevo usuario
          </button>
        </div>

        {/* Buscador */}
        <input
          type="search" placeholder="Buscar por nombre, DNI o rol..."
          value={busqueda} onChange={e => setBusqueda(e.target.value)}
          className="mb-4 w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-200"
        />

        {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {/* ── Vista DESKTOP: tabla ── */}
        <div className="hidden sm:block overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200">
          {loadingData ? (
            <Spinner />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {["DNI","Nombre","Rol","Estado","Acciones"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {usuariosFiltrados.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">No se encontraron usuarios.</td></tr>
                  ) : usuariosFiltrados.map(u => (
                    <tr key={u.usuarioId} className={`transition hover:bg-gray-50 ${!u.activo ? "opacity-50" : ""}`}>
                      <td className="px-4 py-3 font-mono text-gray-600">{u.dni}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{u.nombre}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ROL_COLOR[u.rol]}`}>{ROL_LABEL[u.rol]}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {u.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <AccionesUsuario u={u} onEditar={abrirEditar} onReset={abrirReset} onDesactivar={handleDesactivar} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Vista MOBILE: tarjetas ── */}
        <div className="sm:hidden">
          {loadingData ? (
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200"><Spinner /></div>
          ) : usuariosFiltrados.length === 0 ? (
            <p className="rounded-2xl bg-white px-4 py-8 text-center text-sm text-gray-400 shadow-sm ring-1 ring-gray-200">
              No se encontraron usuarios.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {usuariosFiltrados.map(u => (
                <div key={u.usuarioId} className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200 ${!u.activo ? "opacity-50" : ""}`}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{u.nombre}</p>
                      <p className="mt-0.5 font-mono text-xs text-gray-500">{u.dni}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ROL_COLOR[u.rol]}`}>{ROL_LABEL[u.rol]}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {u.activo ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <AccionesUsuario u={u} onEditar={abrirEditar} onReset={abrirReset} onDesactivar={handleDesactivar} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-700">
          💡 Los usuarios creados o reseteados a su DNI deberán cambiar su contraseña en el primer ingreso por una que cumpla la política de seguridad.
        </div>

      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="mb-4 text-lg font-bold text-gray-800">
              {modal === "crear" ? "Nuevo usuario"
               : modal === "editar" ? `Editar — ${seleccionado?.nombre}`
               : `Resetear contraseña — ${seleccionado?.nombre}`}
            </h2>

            {formError   && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
            {formSuccess && <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">✓ {formSuccess}</p>}

            {modal === "reset" ? (
              <div>
                <p className="mb-4 text-sm text-gray-600">
                  Se reseteará la contraseña de <strong>{seleccionado?.nombre}</strong>.
                  La nueva contraseña será su DNI: <strong className="font-mono">{seleccionado?.dni}</strong>
                </p>
                <div className="flex gap-3">
                  <button onClick={handleReset} disabled={formLoading}
                    className="flex-1 rounded-xl bg-amber-600 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50">
                    {formLoading ? "Reseteando..." : "Confirmar reset"}
                  </button>
                  <button onClick={cerrarModal} className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm text-gray-600 hover:bg-gray-50">
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={modal === "crear" ? handleCrear : handleEditar} className="flex flex-col gap-4">
                {modal === "crear" && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">DNI *</label>
                    <input type="text" inputMode="numeric" value={form.dni}
                      onChange={e => setForm(p => ({...p, dni:e.target.value}))}
                      placeholder="Ej: 35123456" className={inputCls} />
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Nombre y apellido *</label>
                  <input type="text" value={form.nombre}
                    onChange={e => setForm(p => ({...p, nombre:e.target.value}))}
                    placeholder="Ej: Juan Pérez" className={inputCls} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Rol *</label>
                  <select value={form.rol} onChange={e => setForm(p => ({...p, rol:e.target.value}))} className={inputCls}>
                    <option value="alumno">Alumno</option>
                    <option value="docente">Docente</option>
                    <option value="administrador">Administrador</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">
                    {modal === "crear" ? "Contraseña *" : "Nueva contraseña (dejar vacío para no cambiar)"}
                  </label>
                  <input type="password" value={form.password}
                    onChange={e => setForm(p => ({...p, password:e.target.value}))}
                    placeholder={modal === "crear" ? "Mínimo 8, mayúscula y especial" : "Solo si querés cambiarla"}
                    className={inputCls} />
                  {/*
                    * Requisitos visibles:
                    * - Siempre en alta nueva (el password es obligatorio).
                    * - En edición sólo si el admin empezó a escribir algo,
                    *   para no abrumar cuando deja el campo vacío.
                    */}
                  {(modal === "crear" || form.password.length > 0) && (
                    <PasswordRequirements password={form.password} />
                  )}
                </div>
                {modal === "editar" && (
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={form.activo}
                      onChange={e => setForm(p => ({...p, activo:e.target.checked}))}
                      className="h-4 w-4 rounded border-gray-300"/>
                    Usuario activo
                  </label>
                )}
                <div className="flex gap-3 pt-1">
                  <button type="submit" disabled={formLoading}
                    className="flex-1 rounded-xl bg-green-700 py-2.5 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50">
                    {formLoading ? "Guardando..." : modal === "crear" ? "Crear usuario" : "Guardar cambios"}
                  </button>
                  <button type="button" onClick={cerrarModal}
                    className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm text-gray-600 hover:bg-gray-50">
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AccionesUsuario({ u, onEditar, onReset, onDesactivar }) {
  return (
    <>
      <button onClick={() => onEditar(u)}
        className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50">
        Editar
      </button>
      <button onClick={() => onReset(u)}
        className="rounded-lg border border-amber-300 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50">
        Reset pass
      </button>
      {u.activo && u.dni !== "00000001" && (
        <button onClick={() => onDesactivar(u)}
          className="rounded-lg border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
          Desactivar
        </button>
      )}
    </>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center gap-3 py-14">
      <svg className="h-5 w-5 animate-spin text-green-700" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
      </svg>
      <span className="text-sm text-gray-500">Cargando...</span>
    </div>
  );
}
