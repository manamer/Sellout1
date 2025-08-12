import React, { useEffect, useState, useRef } from "react";
import "./css/fybeca.css";
import "@fortawesome/fontawesome-free/css/all.min.css"; // Importar Font Awesome
import { ProgressSpinner } from 'primereact/progressspinner';
import { Toast } from 'primereact/toast';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog'; // Importar ConfirmDialog

const FybecaTipoMueble = () => {
  const [tipoMuebles, setTipoMuebles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]); 
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [editTipoMueble, setEditTipoMueble] = useState(null);
  const [filter, setFilter] = useState("");
  const [filteredTipoMuebles, setFilteredTipoMuebles] = useState([]);
  const [filterTipoMuebleEssence, setFilterTipoMuebleEssence] = useState("");
  const [filterTipoMuebleCatrice, setFilterTipoMuebleCatrice] = useState("");
  const fileInputRef = useRef(null);

  //funcion para el progress spiner
  const [loadingUpload, setLoadingUpload] = useState(false);

  // Función para cargar los tipos de mueble desde la API
  const loadTipoMuebles = async () => {
    setLoading(true);
    setError("");
    try {
      // Asignar siempre el clienteId 5969 
      const clienteId = 5969;
      
      // Modificar la URL para incluir el filtro por cliente
      const response = await fetch(`/api/fybeca/tipo-mueble?clienteId=${clienteId}`);
      if (!response.ok) throw new Error(`Error al cargar tipos de mueble: ${response.statusText}`);

      const data = await response.json();
      setTipoMuebles(data);
      setFilteredTipoMuebles(data); // Mantener filtrado sincronizado
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Función para crear un nuevo tipo de mueble
  const crearTipoMueble = async (tipoMueble) => {
    try {
      const response = await fetch("/api/fybeca/tipo-mueble", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tipoMueble),
      });
  
      if (!response.ok) throw new Error(`Error al crear tipo de mueble: ${response.statusText}`);
  
      setSuccessMessage("Tipo de mueble creado correctamente.");
      await loadTipoMuebles(); // 🔄 Recargar la lista
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };
  

  // Función para actualizar un tipo de mueble
  const actualizarTipoMueble = async (tipoMueble) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/fybeca/tipo-mueble/${tipoMueble.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",},
        body: JSON.stringify(tipoMueble),
      });

      if (!response.ok) throw new Error(`Error al actualizar tipo de mueble: ${response.statusText}`);

      const tipoMuebleActualizado = await response.json();
      const updatedTipoMuebles = tipoMuebles.map((tm) => (tm.id === tipoMuebleActualizado.id ? tipoMuebleActualizado : tm));
      setTipoMuebles(updatedTipoMuebles);
      setFilteredTipoMuebles(updatedTipoMuebles);
      setSuccessMessage("Tipo de mueble actualizado correctamente.");
      setEditTipoMueble(null);
      await loadTipoMuebles(); // 🔄 Recargar la lista
    } catch (error) {
      setError(error.message);
    }
  };

  // Función para manejar la selección de una fila
  const handleSelect = (id) => {
    setSelectedIds((prevSelectedIds) => {
      if (prevSelectedIds.includes(id)) {
        return prevSelectedIds.filter((selectedId) => selectedId !== id); // Desmarcar la casilla
      } else {
        return [...prevSelectedIds, id]; // Marcar la casilla
      }
    });
  };

  // Función para manejar la selección/deselección de todas las filas
  const handleSelectAll = () => {
    if (selectedIds.length === filteredTipoMuebles.length) {
      setSelectedIds([]); // Si ya están todos seleccionados, desmarcar
    } else {
      setSelectedIds(filteredTipoMuebles.map((tm) => tm.id)); // Seleccionar todos
    }
  };

  // Función para eliminar los tipos de muebles seleccionados
  const eliminarTipoMueblesSeleccionados = async () => {
    if (selectedIds.length === 0) {
      toast.current.show({
        severity: 'info',
        summary: 'Información',
        detail: 'No hay tipos de muebles seleccionados para eliminar',
        life: 3000
      });
      return;
    }

    confirmDialog({
      message: `¿Está seguro de eliminar ${selectedIds.length} tipo(s) de mueble?`,
      header: 'Confirmación de eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'No, cancelar',
      acceptClassName: 'p-button-danger fybeca-confirm-button',
      rejectClassName: 'p-button-secondary fybeca-cancel-button',
      className: 'fybeca-confirm-dialog',
      closable: true,
      accept: async () => {
        setLoading(true); // Activar spinner antes de eliminar

        // Dividir en lotes de 2000
        const batchSize = 2000;
        const batches = [];
        for (let i = 0; i < selectedIds.length; i += batchSize) {
          batches.push(selectedIds.slice(i, i + batchSize));
        }

        try {
          for (const batch of batches) {
            const response = await fetch("/api/fybeca/eliminar-varios-tipo-mueble", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(batch),
            });

            if (!response.ok) throw new Error(`Error al eliminar: ${response.statusText}`);
          }

          toast.current.show({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Tipos de muebles eliminados correctamente',
            life: 3000
          });
          await loadTipoMuebles();
          setSelectedIds([]); // Limpiar la selección
        } catch (error) {
          setError(error.message);
          toast.current.show({
            severity: 'error',
            summary: 'Error',
            detail: error.message,
            life: 3000
          });
        } finally {
          setLoading(false);
        }
      }
    });
  };

  // Función para eliminar un tipo de mueble
  const eliminarTipoMueble = async (id) => {
    confirmDialog({
      message: '¿Está seguro de eliminar este tipo de mueble?',
      header: 'Confirmación de eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'No, cancelar',
      acceptClassName: 'p-button-danger fybeca-confirm-button',
      rejectClassName: 'p-button-secondary fybeca-cancel-button',
      className: 'fybeca-confirm-dialog',
      closable: true,
      closeOnEscape: true,
      dismissableMask: true,
      accept: async () => {
        try {
          const response = await fetch(`/api/fybeca/tipo-mueble/${id}`, {
            method: "DELETE",
          });

          if (!response.ok) throw new Error(`Error al eliminar tipo de mueble: ${response.statusText}`);

          const updatedTipoMuebles = tipoMuebles.filter((tm) => tm.id !== id);
          setTipoMuebles(updatedTipoMuebles);
          setFilteredTipoMuebles(updatedTipoMuebles);
          setSuccessMessage("Tipo de mueble eliminado correctamente.");
          toast.current.show({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Tipo de mueble eliminado correctamente',
            life: 3000
          });
          await loadTipoMuebles(); // 🔄 Recargar la lista después de eliminar
        } catch (error) {
          setError(error.message);
          toast.current.show({
            severity: 'error',
            summary: 'Error',
            detail: error.message,
            life: 3000
          });
        }
      }
    });
  };

  // Función para subir un archivo XLSX
  const subirArchivo = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoadingUpload(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/fybeca/template-tipo-muebles", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error(`Error al subir archivo: ${response.statusText}`);

      setSuccessMessage("Archivo subido correctamente.");
      await loadTipoMuebles();
    } catch (error) {
      setError(error.message);
    } finally {
      setLoadingUpload(false);
    }
  };
  
  // Función para manejar el cambio en el campo de entrada del filtro
  const handleFilterChange = (e) => {
    setFilter(e.target.value);
  };

  // Función para aplicar el filtro
  const applyFilter = () => {
    // Asignar siempre el clienteId 5969 
    const clienteId = 5969;
    
    const filtered = tipoMuebles.filter((tipoMueble) => {
      const searchTerm = filter.toLowerCase();
      // Verificar que el tipo de mueble pertenezca al cliente específico
      const esClienteCorrecto = tipoMueble.cliente && tipoMueble.cliente.id === clienteId;
      
      return (
        esClienteCorrecto && // Solo incluir si es del cliente correcto
        (filter === "" || tipoMueble.codPdv.toLowerCase().includes(searchTerm) ||
        tipoMueble.nombrePdv.toLowerCase().includes(searchTerm) ||
        (tipoMueble.ciudad && tipoMueble.ciudad.toLowerCase().includes(searchTerm)) ||
        (tipoMueble.Cliente && tipoMueble.Cliente.codCliente && 
          tipoMueble.Cliente.codCliente.toLowerCase().includes(searchTerm)) ||
        (tipoMueble.Cliente && tipoMueble.Cliente.nombreCliente && 
          tipoMueble.Cliente.nombreCliente.toLowerCase().includes(searchTerm))
        ) &&
        (filterTipoMuebleEssence === "" || tipoMueble.tipoMuebleEssence === filterTipoMuebleEssence) &&
        (filterTipoMuebleCatrice === "" || tipoMueble.tipoMuebleCatrice === filterTipoMuebleCatrice)
      );
    });
  
    setFilteredTipoMuebles(filtered);
  };
  
  // Función para limpiar los filtros
  const clearFilters = () => {
    setFilter("");
    setFilterTipoMuebleEssence("");
    setFilterTipoMuebleCatrice("");
    
    // Asignar siempre el clienteId 5969 
    const clienteId = 5969;
    
    // Filtrar solo por cliente al limpiar otros filtros
    const soloClienteEspecifico = tipoMuebles.filter(
      tipoMueble => tipoMueble.cliente && tipoMueble.cliente.id === clienteId
    );
    
    setFilteredTipoMuebles(soloClienteEspecifico);
  };

  // Cargar los tipos de mueble al montar el componente
  useEffect(() => {
    loadTipoMuebles();
  }, []);

  // Función para descargar el reporte
  const descargarReporte = async () => {
    try {
      // Hacer la solicitud GET a la API
      const response = await fetch("/api/fybeca/reporte-tipo-mueble", {
        method: "GET",
        headers: {
          "Content-Type": "application/json", // Si la API devuelve un archivo, este puede no ser necesario
        },
      });
  
      // Verificar si la respuesta es exitosa
      if (!response.ok) {
        throw new Error(`Error al descargar reporte: ${response.statusText}`);
      }
  
      // Obtener el nombre del archivo desde la cabecera o respuesta
      const contentDisposition = response.headers.get("Content-Disposition");
      const fileName = contentDisposition
        ? contentDisposition.split("filename=")[1].replace(/"/g, "")
        : "reporte__productos.xlsx"; // Nombre por defecto si no se encuentra en las cabeceras
  
      // Crear un Blob a partir de la respuesta (que se espera sea un archivo binario)
      const blob = await response.blob();
  
      // Crear un enlace temporal para realizar la descarga
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;  // Establecer el nombre del archivo a descargar
      document.body.appendChild(a);
      a.click();  // Simular el clic para iniciar la descarga
      a.remove();  // Limpiar el enlace temporal
  
      // Liberar el URL creado
      window.URL.revokeObjectURL(url);
    } catch (error) {
      // Manejar errores
      console.error(`Error al descargar el reporte: ${error.message}`);
      alert(`Error al descargar el reporte: ${error.message}`);
    }
  };

  // Add toast reference
  const toast = useRef(null);

  return (
    <div className="container">
      <h1>Tipos de Mueble Fybeca</h1>
      <Toast ref={toast} />
      <ConfirmDialog />

      {/* Mensajes de error y éxito */}
      {error && <p className="error">{error}</p>}
      {successMessage && <p className="success">{successMessage}</p>}

      <h2>Tipos de Mueble</h2>

      {/* Spinner de carga global */}
      {loadingUpload && (
        <div className="overlay">
          <div className="spinner-container">
            <ProgressSpinner
              style={{ width: "70px", height: "70px" }}
              strokeWidth="8"
              animationDuration="0.7s"
            />
            <p>Subiendo archivo...</p>
          </div>
        </div>
      )}

      {/* Sección de gestión de archivos y reportes */}
      <div className="card-section">
        <h3>Gestión de Archivos y Reportes</h3>
        <div className="button-grid">          
          <div className="button-item">
            <button onClick={descargarReporte} className="btn-general">
              <i className="fas fa-file-excel"></i> Descargar Reporte
            </button>
          </div>
          
          <div className="button-item">
            <a href="/TEMPLATE DE TIPO DE MUEBLE.xlsx" download className="btn-general">
              <i className="fas fa-download"></i> <span>Descargar Template</span>
              <div className="btn-hover-effect"></div>
            </a>
          </div>
          
          <div className="button-item">
            <label className="file-upload" onClick={() => fileInputRef.current.click()}>
              <i className="fas fa-file-upload"></i> Elegir Archivo
            </label>
            <input 
              type="file" 
              accept=".xlsx" 
              onChange={subirArchivo} 
              ref={fileInputRef} 
              style={{ display: "none" }} 
            />
          </div>
        </div>
      </div>

      {/* Sección de filtros */}
      <div className="card-section">
        <h3>Filtros de Búsqueda</h3>
        <div className="filter-container">
          <div className="filter-group">
            <label htmlFor="filter">Búsqueda General:</label>
            <div className="search-input">
              <i className="fas fa-search search-icon"></i>
              <input 
                type="text" 
                id="filter" 
                placeholder="Buscar en todos los campos" 
                value={filter} 
                onChange={handleFilterChange} 
              />
            </div>
          </div>
          
          <div className="filter-group">
            <label htmlFor="filterTipoMuebleEssence">Tipo Display Essence:</label>
            <select 
              id="filterTipoMuebleEssence" 
              value={filterTipoMuebleEssence} 
              onChange={(e) => setFilterTipoMuebleEssence(e.target.value)}
            >
              <option value="">Todos</option>
              {Array.from(new Set(tipoMuebles.map((tm) => tm.tipoMuebleEssence)))
                .filter(tipo => tipo) // Filtrar valores nulos o vacíos
                .sort() // Ordenar alfabéticamente
                .map((tipo) => (
                  <option key={tipo} value={tipo}>{tipo}</option>
                ))
              }
            </select>
          </div>
          
          <div className="filter-group">
            <label htmlFor="filterTipoMuebleCatrice">Tipo MuebleCatrice:</label>
            <select 
              id="filterTipoMuebleCatrice" 
              value={filterTipoMuebleCatrice} 
              onChange={(e) => setFilterTipoMuebleCatrice(e.target.value)}
            >
              <option value="">Todos</option>
              {Array.from(new Set(tipoMuebles.map((tm) => tm.tipoMuebleCatrice)))
                .filter(tipo => tipo) // Filtrar valores nulos o vacíos
                .sort() // Ordenar alfabéticamente
                .map((tipo) => (
                  <option key={tipo} value={tipo}>{tipo}</option>
                ))
              }
            </select>
          </div>
        </div>
        
        <div className="filter-actions">
          <button className="btn-general" onClick={applyFilter}>
            <i className="fas fa-filter"></i> Aplicar Filtros
          </button>
          
          <button className="btn-general" onClick={clearFilters}>
            <i className="fas fa-times"></i> Limpiar Filtros
          </button>
        </div>
      </div>

      {/* Sección de acciones */}
      <div className="card-section">
        <div className="actions-header">
          <h3>Acciones</h3>
          
          {selectedIds.length > 0 && (
            <span className="selected-rows">
              <i className="fas fa-check-square"></i> {selectedIds.length} filas seleccionadas
            </span>
          )}
        </div>
        
        <div className="actions-buttons">
          <button 
            className={`btn-crud ${selectedIds.length === 0 ? 'disabled' : ''}`}
            onClick={eliminarTipoMueblesSeleccionados} 
            disabled={selectedIds.length === 0}
            title="Eliminar"
          >
            <i className="fas fa-trash-alt"></i> Eliminar Seleccionados
          </button>
        </div>
      </div>

      {/* Tabla de tipos de mueble */}
      <div className="card-section table-section">
        <h3>Listado de Tipos de Mueble</h3>
        
        {loading ? (
          <div className="loading-container">
            <ProgressSpinner style={{ width: '50px', height: '50px' }} />
            <p className="loading">Cargando tipos de mueble...</p>
          </div>
        ) : filteredTipoMuebles.length === 0 ? (
          <div className="empty-state">
            <i className="fas fa-search fa-3x"></i>
            <p>No hay tipos de mueble disponibles con los filtros actuales.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={selectedIds.length === filteredTipoMuebles.length}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th>Código Cliente</th>
                  <th>Nombre Cliente</th>
                  <th>Ciudad</th>
                  <th>Código PDV</th>
                  <th>Nombre PDV</th>
                  <th>Tipo Display Essence</th>
                  <th>Tipo Mueble Display Catrice</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredTipoMuebles.map((tipoMueble) => (
                  <tr key={tipoMueble.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(tipoMueble.id)}
                        onChange={() => handleSelect(tipoMueble.id)}
                      />
                    </td>
                    <td>{tipoMueble.cliente && tipoMueble.cliente.codCliente ? tipoMueble.cliente.codCliente : "N/A"}</td>
                    <td>{tipoMueble.cliente && tipoMueble.cliente.nombreCliente ? tipoMueble.cliente.nombreCliente : "N/A"}</td>
                    <td>{tipoMueble.ciudad || "N/A"}</td>
                    <td>{tipoMueble.codPdv}</td>
                    <td>{tipoMueble.nombrePdv}</td>
                    <td>{tipoMueble.tipoMuebleEssence}</td>
                    <td>{tipoMueble.tipoMuebleCatrice}</td>
                    <td className="action-buttons">
                      <button className="btn-crud" onClick={() => setEditTipoMueble(tipoMueble)} title="Editar">
                        <i className="fas fa-pencil-alt"></i>
                      </button>
                      <button className="btn-crud" onClick={() => eliminarTipoMueble(tipoMueble.id)} title="Eliminar">
                        <i className="fas fa-trash-alt"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de edición */}
      {editTipoMueble && (
        <div className="modal">
          <div className="modal-content">
            <h2>{editTipoMueble.id ? "Editar Tipo de Mueble" : "Crear Tipo de Mueble"}</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (editTipoMueble.id) {
                  actualizarTipoMueble(editTipoMueble);
                } else {
                  crearTipoMueble(editTipoMueble);
                }
              }}
            >
              <label>Código Cliente:</label>
              <input
                type="text"
                name="codCliente"
                value={editTipoMueble.cliente ? editTipoMueble.cliente.codCliente : ""}
                onChange={(e) => setEditTipoMueble({ ...editTipoMueble, Cliente: { ...editTipoMueble.cliente, codCliente: e.target.value } })}
              />
              <label>Nombre Cliente:</label>
              <input
                type="text"
                name="nombreCliente"
                value={editTipoMueble.cliente ? editTipoMueble.cliente.nombreCliente : ""}
                onChange={(e) => setEditTipoMueble({ ...editTipoMueble, Cliente: { ...editTipoMueble.Cliente, nombreCliente: e.target.value } })}
              />
              <label>Ciudad:</label>
              <input
                type="text"
                name="ciudad"
                value={editTipoMueble.ciudad}
                onChange={(e) => setEditTipoMueble({ ...editTipoMueble, ciudad: e.target.value })}
              />
              <label>Código PDV:</label>
              <input
                type="text"
                name="codPdv"
                value={editTipoMueble.codPdv}
                onChange={(e) => setEditTipoMueble({ ...editTipoMueble, codPdv: e.target.value })}
              />
              <label>Nombre PDV:</label>
              <input
                type="text"
                name="nombrePdv"
                value={editTipoMueble.nombrePdv}
                onChange={(e) => setEditTipoMueble({ ...editTipoMueble, nombrePdv: e.target.value })}
              />
              <label>Tipo Mueble Essence:</label>
              <select
                name="tipoMuebleEssence"
                value={editTipoMueble.tipoMuebleEssence}
                onChange={(e) => setEditTipoMueble({ ...editTipoMueble, tipoMuebleEssence: e.target.value })}
              >
                <option value="">Seleccione...</option>
                {Array.from(new Set(tipoMuebles.map((tm) => tm.tipoMuebleEssence))).map((tipo) => (
                  <option key={tipo} value={tipo}>{tipo}</option>
                ))}
              </select>
              <label>Tipo Mueble Catrice:</label>
                <select
                  name="tipoMuebleCatrice"
                  value={editTipoMueble.tipoMuebleCatrice}
                  onChange={(e) => setEditTipoMueble({ ...editTipoMueble, tipoMuebleCatrice: e.target.value })}
                >
                  <option value="">Seleccione...</option>
                  {Array.from(new Set(tipoMuebles.map((tm) => tm.tipoMuebleCatrice))).map((tipo) => (
                    <option key={tipo} value={tipo}>{tipo}</option>
                  ))}
                </select>
              <button type="submit" className="btn-crud">Guardar Cambios</button>
              <button type="button" className="btn-crud" onClick={() => setEditTipoMueble(null)}>Cancelar</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FybecaTipoMueble;