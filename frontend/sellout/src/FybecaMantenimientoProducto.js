import React, { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEdit, faFileUpload, faFileDownload } from "@fortawesome/free-solid-svg-icons";
import "./css/fybeca.css"; // Asegúrate de tener tu archivo CSS
import { ProgressSpinner } from 'primereact/progressspinner';

const FybecaMantenimientoProducto = () => {
  const [productos, setProductos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [productoEditar, setProductoEditar] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [file, setFile] = useState(null);
  const [page, setPage] = useState(1);
  const [itemsPerPage] = useState(2000); // Paginación por lote de 2000 productos
  const [filter, setFilter] = useState(""); // Estado para almacenar el filtro

  useEffect(() => {
    const fetchProductos = async () => {
      try {
        const response = await fetch("/api/fybeca/productos");
        if (!response.ok) {
          throw new Error("Error al obtener los productos");
        }
        const data = await response.json();
        setProductos(data);
      } catch (error) {
        console.error(error);
      }
    };

    fetchProductos();
  }, []);

  // Cargar productos con paginación
  const loadProductos = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/fybeca/productos?page=${page}&size=${itemsPerPage}`);
      if (!response.ok) {
        throw new Error(`Error al cargar productos: ${response.statusText}`);
      }
      const data = await response.json();
      setProductos(data);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Cargar todos los clientes
  const loadClientes = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/fybeca/cliente");
      if (!response.ok) {
        throw new Error(`Error al cargar clientes: ${response.statusText}`);
      }
      const data = await response.json();
      setClientes(data);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Crear o actualizar un producto
  const handleSaveProducto = async (e) => {
    e.preventDefault();
    setLoading(true); // Activa el spinner mientras se guarda el producto
    try {
      const response = await fetch("/api/fybeca/producto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productoEditar),
      });
      if (!response.ok) {
        throw new Error("Error al guardar el producto");
      }
      await loadProductos(); // 🔄 Recargar lista de productos después de guardar
      setShowModal(false);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false); // Desactiva el spinner después del proceso
    }
  };
  

  // Editar producto
  const handleEdit = (id) => {
    const producto = productos.find((p) => p.id === id);
    setProductoEditar(producto);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setProductoEditar(null);
  };

  // Manejo de entradas del formulario
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProductoEditar((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Cargar productos desde un archivo XLSX
  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUploadFile = async () => {
    if (!file) {
      alert("Por favor, seleccione un archivo");
      return;
    }
  
    setLoading(true); // Activa el spinner antes de subir el archivo
    const formData = new FormData();
    formData.append("file", file);
  
    try {
      const response = await fetch("/api/fybeca/template-productos", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error("Error al cargar el archivo");
      }
      alert(await response.text()); // Mensaje de éxito
      await loadProductos(); // 🔄 Recargar lista de productos
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false); // Desactiva el spinner después del proceso
    }
  };
  

  // Eliminar productos seleccionados
  const handleDeleteSelected = async () => {
    const selectedIds = productos
      .filter((producto) => producto.selected)
      .map((producto) => producto.id);
  
    if (selectedIds.length === 0) {
      alert("No hay productos seleccionados para eliminar.");
      return;
    }
  
    const confirmDelete = window.confirm(
      `¿Estás seguro de eliminar ${selectedIds.length} producto(s)?`
    );
    if (!confirmDelete) return;
  
    setLoading(true); // Activa el spinner antes de eliminar
  
    // 🔹 Definir `batches` correctamente
    const batchSize = 2000;
    const batches = [];
    for (let i = 0; i < selectedIds.length; i += batchSize) {
      batches.push(selectedIds.slice(i, i + batchSize));
    }
  
    try {
      for (const batch of batches) {
        const response = await fetch("/api/fybeca/productos", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(batch),
        });
  
        if (!response.ok) {
          throw new Error("Error al eliminar los productos en uno de los lotes");
        }
      }
  
      alert("Productos eliminados correctamente.");
      await loadProductos(); // 🔄 Recargar productos después de eliminar
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false); // Desactiva el spinner después del proceso
    }
  };
  
  

  // Filtrar productos por el filtro ingresado
  const filteredProductos = productos.filter((producto) => {
    return (
      producto.codItem.toLowerCase().includes(filter.toLowerCase()) ||
      producto.codBarraSap.toLowerCase().includes(filter.toLowerCase())
    );
  });

  // Cargar productos y clientes al inicio
  useEffect(() => {
    loadProductos();
    loadClientes();
  }, [page]); // Cambia la página cada vez que se actualice el número de página

  // Función para generar el reporte con los filtros aplicados
  const generateReport = async () => {
    try {
      const response = await fetch("/api/fybeca/reporte-productos", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Error al generar el reporte");
      }

      const reportBlob = await response.blob();
      const url = URL.createObjectURL(reportBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "reporte_productos.xlsx"; // Nombre del archivo a descargar
      link.click();
      URL.revokeObjectURL(url); // Limpiar el objeto URL después de la descarga
    } catch (error) {
      console.error("Error al generar el reporte:", error);
    }
  };

  return (
    <div className="container">
      <h1>Mantenimiento Producto</h1>

      {loading ? (
         <div style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "200px" // Ajusta la altura para centrar el spinner
        }}>
          <ProgressSpinner
            style={{ width: "50px", height: "50px" }}
            strokeWidth="6"
            fill="var(--surface-ground)"
            animationDuration="0.7s"
          />
        </div>
      ) : error ? (
        <p className="error">Error: {error}</p>
      ) : (
        <>
          {/* Botones arriba de la tabla */}
          <div className="buttons-top">
            <div className="upload-section">
              <h3 class="text-black">Cargar Archivo XLSX</h3>
              <div className="file-upload" onClick={() => document.getElementById('fileInput').click()}>
                <FontAwesomeIcon icon={faFileUpload} /> Elegir Archivo
              </div>
              <input
                type="file"
                id="fileInput"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
              <button onClick={handleUploadFile} className="btn-upload">
                Cargar Productos
              </button>
              <a href="/TEMPLATE CODIGOS BARRA Y ITEM.xlsx" download="TEMPLATE CODIGOS BARRA Y ITEM.xlsx">
                <button className="tomato-button">Descargar Template</button>
              </a>
            </div>

            <button
              onClick={handleDeleteSelected}
              className="btn-delete"
              disabled={!productos.some((producto) => producto.selected)}
            >
              Eliminar Seleccionados
            </button>
            
            {/* Botón para generar reporte */}
            <button onClick={generateReport} className="btn-download">
              <FontAwesomeIcon icon={faFileDownload} /> Generar Reporte
            </button>
          </div>

          {/* Filtro de productos */}
          <div className="filter-section">
            <input
              type="text"
              placeholder="Filtrar productos"
              value={filter}
              onChange={(e) => setFilter(e.target.value)} // Actualizar el estado del filtro
              className="filter-input"
            />
          </div>

          {/* Lista de productos */}
          <table className="producto-table">
            <thead>
              <tr>
                <th>Selección</th>
                <th>Código Item</th>
                <th>Código Barra SAP</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredProductos.map((producto) => (
                <tr key={producto.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={producto.selected || false}
                      onChange={() => {
                        producto.selected = !producto.selected;
                        setProductos([...productos]);
                      }}
                    />
                  </td>
                  <td>{producto.codItem}</td>
                  <td>{producto.codBarraSap}</td>
                  <td>
                    <button onClick={() => handleEdit(producto.id)} className="btn-edit">
                      <FontAwesomeIcon icon={faEdit} /> Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Modal para editar producto */}
          {showModal && (
            <div className="modal">
              <div className="modal-content">
                <h3>Editar Producto</h3>
                <form onSubmit={handleSaveProducto}>
                  <label>Código Item</label>
                  <input
                    type="text"
                    name="codItem"
                    value={productoEditar.codItem}
                    onChange={handleInputChange}
                    required
                  />
                  <label>Código Barra SAP</label>
                  <input
                    type="text"
                    name="codBarraSap"
                    value={productoEditar.codBarraSap}
                    onChange={handleInputChange}
                    required
                  />
                  <button type="submit">Guardar</button>
                </form>
                <button onClick={handleCloseModal}>Cerrar</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default FybecaMantenimientoProducto;
