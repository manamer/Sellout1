import React, { useEffect, useState, useRef } from "react";
import "./css/deprati.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import * as XLSX from 'xlsx';
import { Toast } from 'primereact/toast';
import "primereact/resources/themes/lara-light-indigo/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";
import "primeflex/primeflex.css";
import { ProgressSpinner } from 'primereact/progressspinner';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { Card } from 'primereact/card';
import { Toolbar } from 'primereact/toolbar';
import { Divider } from 'primereact/divider';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { Paginator } from 'primereact/paginator';
import { Calendar } from 'primereact/calendar';
import { InputNumber } from 'primereact/inputnumber';
import { useMemo } from "react";
const Fybeca = () => {
  // Referencias
  const toast = useRef(null);
  const fileInputRef = useRef(null);
  
  // Estados para gestionar los datos de ventas
  const [ventas, setVentas] = useState([]);
  const [filteredVentas, setFilteredVentas] = useState([]);
  const [loadingVentas, setLoadingVentas] = useState(false);
  const [errorVentas, setErrorVentas] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [editVenta, setEditVenta] = useState(null);
  const [selectedVentas, setSelectedVentas] = useState([]);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  
  // Estados para filtros
  const [filter, setFilter] = useState("");
  // Estados para filtros (reemplaza los tuyos)
  const [filterYear, setFilterYear] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterMarca, setFilterMarca] = useState("");
  const [filterDate, setFilterDate] = useState(null);
  const [ciudades, setCiudades] = useState({});
  const [yearsOptions, setYearsOptions] = useState([]);
  const [monthsOptions, setMonthsOptions] = useState([]);
  const [loadingReporte, setLoadingReporte] = useState(false);
  const [errorReporte, setErrorReporte] = useState("");
  const [globalFilter, setGlobalFilter] = useState('');
  const [marcas, setMarcas] = useState([]);
  const [paginatorState, setPaginatorState] = useState({
    first: 0,
    rows: 10,
    page: 0,
    totalRecords: 0
  });
  
  // Constantes
  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  //funcion para los mensajes de show toast
  const showToast = ({ type = 'info', summary, detail, life = 3000 }) => {
    toast.current.show({
      severity: type,
      life,
      content: (
        <div className={`flex justify-content-between align-items-start deprati-toast deprati-toast-${type}`} style={{ gap: '1rem' }}>
          <div className="flex flex-column">
            <span className="font-bold mb-1">{summary}</span>
            <span>{detail}</span>
          </div>
          <Button 
            icon="pi pi-times" 
            className="p-button-rounded p-button-text text-sm text-500"
            style={{ width: '2rem', height: '2rem' }}
            onClick={() => toast.current.clear()} 
          />
        </div>
      )
    });
  };
  const buildQuery = () => {
    const params = new URLSearchParams();
    params.set('clienteId', '5969'); // importante

    if (filterYear)  params.set('anio', String(filterYear));
    if (filterMonth) params.set('mes', String(filterMonth));
    if (filterMarca) params.set('marca', filterMarca);
    if (filterDate) {
      const d = new Date(filterDate);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      params.set('fecha', `${yyyy}-${mm}-${dd}`);
    }
    return params.toString();
  };

  const loadYearsOptions = async () => {
    try {
      const resp = await fetch("/api/fybeca/anios-disponibles?clienteId=5969");
      if (!resp.ok) throw new Error("Error al cargar años");
      const data = await resp.json(); // [2023, 2024, ...]
      setYearsOptions(data.map(y => ({ label: String(y), value: y })));
    } catch (e) {
      console.error(e);
      showWarn("No se pudieron cargar los años disponibles");
    }
  };


  const hasAnyFilter = useMemo(
    () => Boolean(filterYear || filterMonth || filterMarca || filterDate),
    [filterYear, filterMonth, filterMarca, filterDate]
  );

  const fetchVentasWithFilters = async () => {
  if (!filterYear && !filterMonth && !filterMarca && !filterDate) {
    setVentas([]);
    setFilteredVentas([]);
    setPaginatorState(prev => ({ ...prev, totalRecords: 0, first: 0, page: 0 }));
    showWarn("Selecciona al menos un filtro para cargar ventas.");
    return;
  }

  setLoadingVentas(true);
  try {
    const qs = buildQuery();
    const resp = await fetch(`/api/fybeca/venta?${qs}`); // <- aquí
    if (!resp.ok) throw new Error("Error al cargar ventas");
    const data = await resp.json();

    const processed = data.map(v => (v?.cliente?.ciudad ? { ...v, ciudad: v.cliente.ciudad } : v));

    setVentas(processed);
    setFilteredVentas(processed); // backend ya devolvió filtrado
    setPaginatorState(prev => ({ ...prev, totalRecords: processed.length, first: 0, page: 0 }));

    showSuccess(`Se encontraron ${processed.length} registros con los filtros aplicados.`);
  } catch (e) {
    console.error(e);
    showError("Error al cargar ventas");
    setVentas([]);
    setFilteredVentas([]);
    setPaginatorState(prev => ({ ...prev, totalRecords: 0, first: 0, page: 0 }));
  } finally {
    setLoadingVentas(false);
  }
};


  // Cargar datos iniciales
  useEffect(() => {
  loadMarcas();
  loadYearsOptions()
  }, []);
  
  
  // CONST meses como en Deprati
  const months = [
    { label: 'Enero', value: 1 },
    { label: 'Febrero', value: 2 },
    { label: 'Marzo', value: 3 },
    { label: 'Abril', value: 4 },
    { label: 'Mayo', value: 5 },
    { label: 'Junio', value: 6 },
    { label: 'Julio', value: 7 },
    { label: 'Agosto', value: 8 },
    { label: 'Septiembre', value: 9 },
    { label: 'Octubre', value: 10 },
    { label: 'Noviembre', value: 11 },
    { label: 'Diciembre', value: 12 },
  ];

  // Años desde los datos (igual que Deprati)
  const years = useMemo(
    () => [...new Set(ventas.map(v => v.anio))].sort(),
    [ventas]
  );
  // Actualizar el total de registros cuando cambian los datos filtrados
  useEffect(() => {
    setPaginatorState(prev => ({
      ...prev,
      totalRecords: filteredVentas.length,
      first: 0,
      page: 0,
    }));
  }, [filteredVentas]);

  
  // Manejador para cambios en la paginación
  const onPageChange = (event) => {
    setPaginatorState(event);
  };


  /**
   * Muestra mensaje de éxito
   */
  const showSuccess = (msg) => {
  showToast({ type: 'success', summary: 'Éxito', detail: msg });
  };

  const showInfo = (msg) => {
    showToast({ type: 'info', summary: 'Información', detail: msg });
  };

  const showWarn = (msg) => {
    showToast({ type: 'warn', summary: 'Advertencia', detail: msg });
  };

  const showError = (msg) => {
    showToast({ type: 'error', summary: 'Error', detail: msg });
  };


  const CLIENTE_ID = 5969;

  const loadVentas = async () => {
    setLoadingVentas(true);
    setErrorVentas("");
    try {
      const response = await fetch("/api/fybeca/venta");
      if (!response.ok) throw new Error("Error al cargar ventas");
      const data = await response.json();
      
      // Procesar los datos para extraer la ciudad desde MantenimientoCliente
      const processedData = data.map(venta => {
        // Si la venta tiene un cliente con ciudad, usar esa ciudad
        if (venta.cliente && venta.cliente.ciudad) {
          return {
            ...venta,
            ciudad: venta.cliente.ciudad
          };
        }
        return venta;
      });
      
      setVentas(processedData);
      setFilteredVentas(processedData);
    } catch (error) {
      console.error(error);
      setErrorVentas("Error al cargar ventas");
      showError("Error al cargar ventas");
    } finally {
      setLoadingVentas(false);
    }
  };

  // Función para cargar las marcas disponibles desde la API
  const loadMarcas = async () => {
    try {
      const response = await fetch("/api/fybeca/marcas-ventas");
      if (!response.ok) throw new Error("Error al cargar marcas");
      const data = await response.json();
      setMarcas(data);
    } catch (error) {
      console.error(error);
      showError("Error al cargar las marcas");
    }
  };

  // Función para cargar las ciudades desde el API
  const loadCiudades = async () => {
    try {
      const response = await fetch("/api/fybeca/ciudades-ventas");
      if (!response.ok) throw new Error("Error al cargar las ciudades");
      const data = await response.json();
      setCiudades(data);
    } catch (error) {
      console.error("Error en loadCiudades:", error);
      showError("Error al cargar las ciudades");
    }
  };

  // Función para cargar el template de ventas
  const cargarTemplate = async (file) => {
    setLoadingTemplate(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/fybeca/subir-archivo-venta", {
        method: "POST",
        body: formData,
      });

      if (!response.ok)
        throw new Error(`Error al cargar el archivo: ${response.statusText}`);

      const blob = await response.blob();
      const text = await blob.text();

      if (text && text.trim().length > 0) {
        // Si hay contenido en el archivo (códigos no encontrados), descargarlo
        await guardarCodigosNoEncontrados(text);
        showWarn("Archivo cargado, pero se encontraron códigos no reconocidos.");
      } else {
        showSuccess("Archivo cargado correctamente");
      }

      await loadVentas(); // Recarga las ventas
      handleApplyFilters();
    } catch (error) {
      showError(error.message);
    } finally {
      setLoadingTemplate(false);
    }
  };

  const guardarCodigosNoEncontrados = async (contenido) => {
    try {
      if ('showSaveFilePicker' in window) {
        const handle = await window.showSaveFilePicker({
          suggestedName: 'codigos_no_encontrados.txt',
          types: [
            {
              description: 'Archivo de texto',
              accept: { 'text/plain': ['.txt'] }
            }
          ]
        });

        const writable = await handle.createWritable();
        await writable.write(contenido);
        await writable.close();

        showInfo("Archivo .txt generado con códigos no encontrados");
      } else {
        showWarn("Tu navegador no soporta la descarga del archivo .txt automáticamente. Usa Chrome o Edge.");
      }
    } catch (error) {
      console.error("Error al guardar archivo:", error);
      showError("Ocurrió un error al intentar guardar el archivo .txt");
    }
  };


  // Función para actualizar una venta
  const actualizarVenta = async (venta) => {
    try {
      const response = await fetch(`/api/fybeca/venta/${venta.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(venta),
      });

      if (!response.ok) throw new Error(`Error al actualizar la venta: ${response.statusText}`);

      showSuccess('Venta actualizada correctamente');
      setEditVenta(null);
      await loadVentas();
      handleApplyFilters();
    } catch (error) {
      showError(error.message);
    }
  };

  // Función para eliminar una venta
  const eliminarVenta = (id) => {
    confirmDialog({
      message: '¿Está seguro de eliminar esta venta?',
      header: 'Confirmación de eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'No, cancelar',
      acceptClassName: 'p-button-danger',
      className: 'deprati-confirm-dialog',
      acceptClassName: 'p-button-danger deprati-confirm-button',
      rejectClassName: 'p-button-secondary deprati-cancel-button',
      closable: false,
      accept: async () => {
        try {
          const response = await fetch(`/api/fybeca/venta/${id}`, {
            method: "DELETE",
          });

          if (!response.ok)
            throw new Error(`Error al eliminar la venta: ${response.statusText}`);

          showSuccess('Venta eliminada correctamente');
          await loadVentas();
          handleApplyFilters();
        } catch (error) {
          showError(error.message);
        }
      }
    });
  };

  // Función para eliminar ventas seleccionadas
  const eliminarVentasSeleccionadas = () => {
    if (selectedVentas.length === 0) {
      showInfo('No hay ventas seleccionadas para eliminar');
      return;
    }
    
    confirmDialog({
      message: `¿Está seguro de eliminar ${selectedVentas.length} venta(s)?`,
      header: 'Confirmación de eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'No, cancelar',
      acceptClassName: 'p-button-danger',
      closable:false,
      accept: async () => {
        try {
          const response = await fetch("/api/fybeca/ventas-forma-masiva", {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(selectedVentas),
          });
      
          if (!response.ok) {
            throw new Error("Error al eliminar las ventas");
          }
      
          showSuccess('Ventas eliminadas correctamente');
          await loadVentas();
          setSelectedVentas([]);
          handleApplyFilters();
        } catch (error) {
          showError('Error al eliminar las ventas');
        }
      }
    });
  };

  // Función para generar el reporte Ranquin Ventas
  const generarReporteRanquinVentas = async () => {
    setLoadingReporte(true);
    setErrorReporte("");

    try {
      const response = await fetch("/api/fybeca/reporte-ranquin-ventas");
      if (!response.ok) throw new Error("Error al obtener el reporte Ranquin Ventas");

      const data = await response.json();
      if (!data.length) {
        showWarn("No hay datos disponibles para el reporte.");
        return;
      }

      // Crear hoja de Excel con los datos obtenidos
      const ws = XLSX.utils.json_to_sheet(
        data.map(row => ({
          "Código PDV": row[0],
          "PDV": row[1],
          "Ciudad": row[2],
          "Tipo Display Essence": row[3],
          "Tipo Mueble Display Catrice": row[4],
          "Total Unidades Mes": row[5],
          "Promedio Mes": row[6],
          "Unidades Diarias": row[7],
        }))
      );

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Reporte Ranquin Ventas");

      // Descargar el archivo Excel
      XLSX.writeFile(wb, "Reporte_Ranquin_Ventas.xlsx");
      showSuccess('Reporte generado correctamente');

    } catch (error) {
      showError(error.message);
    } finally {
      setLoadingReporte(false);
    }
  };

  // Función para descargar el reporte de ventas
  const downloadVentasReport = async () => {
    setLoadingVentas(true);
  
    try {
      const response = await fetch("/api/fybeca/reporte-ventas", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
  
      if (!response.ok) {
        throw new Error("Error al descargar el reporte de ventas");
      }
  
      const reportData = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(reportData);
      link.download = "reporte_ventas.xlsx";
      link.click();
      
      showSuccess('Reporte de ventas descargado correctamente');
    } catch (error) {
      showError(error.message);
    } finally {
      setLoadingVentas(false);
    }
  };

  // Función para exportar los datos a XLSX
  const exportToXLSX = () => {
    const exportData = filteredVentas.map((venta) => ({
      Año: venta.anio,
      Mes: venta.mes,
      Dia: venta.dia,
      Marca: venta.marca,
      "Cliente ID": venta.cliente ? venta.cliente.codCliente : "N/A",
      "Nombre Cliente": venta.cliente ? venta.cliente.nombreCliente : "N/A",
      "Código Barra SAP": venta.codBarra,
      "Código Producto SAP": venta.codigoSap,
      "Código Item": venta.producto ? venta.producto.codItem : "N/A",
      "Nombre Producto": venta.nombreProducto,
      "Código PDV": venta.codPdv,
      Ciudad: venta.cliente ? venta.cliente.ciudad : "N/A",
      PDV: venta.pdv,
      "Stock en Dólares": venta.stockDolares !== undefined ? venta.stockDolares.toFixed(2) : "0.00",
      "Stock en Unidades": venta.stockUnidades,
      "Venta en Dólares": venta.ventaDolares !== undefined ? venta.ventaDolares.toFixed(2) : "0.00",
      "Venta en Unidades": venta.ventaUnidad,
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ventas");

    XLSX.writeFile(wb, "Ventas_Fybeca.xlsx");
    showSuccess('Datos exportados correctamente');
  };

  // Función para manejar la selección de una venta
  const handleSelectVenta = (id) => {
    setSelectedVentas((prevSelected) =>
      prevSelected.includes(id)
        ? prevSelected.filter((ventaId) => ventaId !== id)
        : [...prevSelected, id]
    );
  };

  // Función para seleccionar/deseleccionar todas las ventas
  const handleSelectAll = () => {
    if (selectedVentas.length === filteredVentas.length) {
      setSelectedVentas([]);
    } else {
      setSelectedVentas(filteredVentas.map((venta) => venta.id));
    }
  };

  const handleApplyFilters = async () => {
    // Lazy load: si no hay ventas cargadas todavía, las cargamos una vez
    if (ventas.length === 0) {
      await loadVentas(); // esto setea ventas y filteredVentas con todo
    }

    let filtered = [...ventas];

    if (filterYear) {
      filtered = filtered.filter(v => v.anio === parseInt(filterYear));
    }
    if (filterMonth) {
      filtered = filtered.filter(v => v.mes === parseInt(filterMonth));
    }
    if (filterMarca) {
      filtered = filtered.filter(v => v.marca && v.marca.toLowerCase() === filterMarca.toLowerCase());
    }
    if (filterDate) {
      const selectedDate = new Date(filterDate);
      filtered = filtered.filter(v => {
        const ventaDate = new Date(v.anio, v.mes - 1, v.dia);
        return (
          ventaDate.getFullYear() === selectedDate.getFullYear() &&
          ventaDate.getMonth() === selectedDate.getMonth() &&
          ventaDate.getDate() === selectedDate.getDate()
        );
      });
    }

    setFilteredVentas(filtered);

    if (filtered.length === 0) {
      showInfo("No se encontraron datos para los filtros aplicados");
    } else {
      showSuccess(`Se encontraron ${filtered.length} registros con los filtros aplicados`);
    }
  };


 /**
   * Limpia todos los filtros aplicados
   * Función independiente para resetear filtros
   */
  const handleClearFilters = () => {
    setFilterYear("");
    setFilterMonth("");
    setFilterMarca("");
    setFilterDate(null);
    setGlobalFilter('');
    setFilteredVentas(ventas);
  };


  // Función para limpiar los filtros
  const handleAplicarFiltros = async () => {
    // Limpiar todos los estados de filtro
    setFilterYear("");
    setFilterMonth("");
    setFilterMarca("");
    setGlobalFilter("");
    setFilteredVentas(ventas);
    
    // Recargar todas las ventas sin filtros pero manteniendo el filtro de cliente
    setLoadingVentas(true);
    try {
      const response = await fetch(`/api/fybeca/venta?clienteId=5969`);
      if (!response.ok) throw new Error("Error al cargar ventas");
  
      const data = await response.json();
      // Filtrar adicionalmente en el frontend para asegurar que solo se muestren datos del cliente 5969
      const ventasFiltradas = data.filter(venta => venta.cliente && venta.cliente.id === 5969);
      setVentas(ventasFiltradas);
      setFilteredVentas(ventasFiltradas);
      setPaginatorState(prevState => ({
        ...prevState,
        totalRecords: ventasFiltradas.length,
        first: 0,
        page: 0
      }));
      
      showSuccess('Filtros limpiados correctamente');
    } catch (error) {
      setErrorVentas(error.message);
      showError(error.message);
    } finally {
      setLoadingVentas(false);
    }
  };

  // Función para renderizar las acciones en cada fila
  const actionBodyTemplate = (rowData) => {
    return (
      <div className="flex gap-2 justify-content-center">
        <Button 
          icon="pi pi-pencil" 
          className="p-button-rounded p-button-success p-button-outlined" 
          onClick={() => setEditVenta(rowData)} 
          tooltip="Editar"
        />
        <Button 
          icon="pi pi-trash" 
          className="p-button-rounded p-button-danger p-button-outlined" 
          onClick={() => eliminarVenta(rowData.id)} 
          tooltip="Eliminar"
        />
      </div>
    );
  };

  // Función para renderizar la columna de selección
  const selectionBodyTemplate = (rowData) => {
    return (
      <div className="flex justify-content-center">
        <input
          type="checkbox"
          checked={selectedVentas.includes(rowData.id)}
          onChange={() => handleSelectVenta(rowData.id)}
          className="p-checkbox"
        />
      </div>
    );
  };
  // Función para exportar los datos filtrados a Excel
  const downloadFilteredVentasReport = () => {
    if (filteredVentas.length === 0) {
      showWarn("No hay datos filtrados para generar el reporte.");
      return;
    }
    
    // Preparar los datos para exportación con formato mejorado
    const exportData = filteredVentas.map(venta => ({
      'Año': venta.anio,
      'Mes': monthNames[venta.mes - 1],
      'Día': venta.dia,
      'Marca': venta.marca,
      'Código Cliente': venta.cliente ? venta.cliente.codCliente : "N/A",
      'Nombre Cliente': venta.cliente ? venta.cliente.nombreCliente : "N/A",
      'Código Barra': venta.codBarra,
      'Código SAP': venta.codigoSap,
      'Producto': venta.nombreProducto,
      'Código PDV': venta.codPdv,
      'PDV': venta.pdv,
      'Ciudad': venta.cliente ? venta.cliente.ciudad : "N/A",
      'Stock ($)': venta.stockDolares !== undefined ? venta.stockDolares.toFixed(2) : "0.00",
      'Stock (U)': venta.stockUnidades,
      'Venta ($)': venta.ventaDolares !== undefined ? venta.ventaDolares.toFixed(2) : "0.00",
      'Venta (U)': venta.ventaUnidad
    }));
  
    // Crear el archivo Excel
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ventas Filtradas");
    
    // Generar nombre de archivo con fecha actual
    const today = new Date();
    const dateStr = `${today.getDate()}-${today.getMonth()+1}-${today.getFullYear()}`;
    
    // Crear nombre descriptivo basado en los filtros aplicados
    let fileName = `Reporte_Ventas_Fybeca_`;
    if (filterYear) fileName += `${filterYear}_`;
    if (filterMonth) fileName += `${monthNames[parseInt(filterMonth)-1]}_`;
    if (filterMarca) fileName += `${filterMarca}_`;
    fileName += dateStr + '.xlsx';
    
    // Descargar el archivo
    XLSX.writeFile(wb, fileName);
    
    showSuccess(`Se ha generado el reporte con ${exportData.length} registros.`);
  };
  // Función para renderizar el encabezado de selección
  const selectionHeaderTemplate = () => {
    return (
      <div className="flex justify-content-center">
        <input
          type="checkbox"
          checked={selectedVentas.length === filteredVentas.length && filteredVentas.length > 0}
          onChange={handleSelectAll}
          className="p-checkbox"
        />
      </div>
    );
  };

  // Renderizado del componente
  return (
    <div className="fybeca-container">
      <Toast ref={toast} />
      <ConfirmDialog />
      <Card className="fybeca-card"></Card>
      <div className="grid">
        <div className="col-12">
          <div className="card">
            <h1 className="text-center mb-4">Ventas Fybeca</h1>
            {/* Toolbar con acciones principales */}
            <Toolbar className="mb-4" 
              left={
                <div className="flex flex-wrap gap-2">
                  <Button 
                    label="Eliminar Seleccionados" 
                    icon="pi pi-trash" 
                    className="p-button-danger" 
                    onClick={eliminarVentasSeleccionadas} 
                    disabled={selectedVentas.length === 0}
                  />
                </div>
              }
              right={
                <div className="flex flex-wrap gap-2">
                  <Button 
                    label="Importar Excel" 
                    icon="pi pi-upload" 
                    className="p-button-help" 
                    onClick={() => fileInputRef.current.click()}
                  />
                  <input 
                    type="file" 
                    accept=".xlsx, .csv" 
                    onChange={(e) => {
                      if (e.target.files.length > 0) {
                        cargarTemplate(e.target.files[0]);
                        e.target.value = ""; // <- Limpia el input para que pueda subir el mismo archivo otra vez
                      }
                    }} 
                    ref={fileInputRef} 
                    style={{ display: "none" }} 
                  />
                  <Button 
                    label="Descargar Template" 
                    icon="pi pi-download" 
                    className="p-button-info" 
                    onClick={() => window.location.href = "/TEMPLATE VENTAS FYBECA.xlsx"}
                  />
                 
                  <Button 
                    label="Reporte Ventas" 
                    icon="pi pi-file-excel" 
                    className="p-button-success" 
                    onClick={downloadVentasReport}
                    disabled={loadingVentas}
                  />
                </div>
              }
            />
            <Card className="deprati-filter-card mb-3">
                <h3 className="deprati-section-title text-primary mb-3">Filtros de Búsqueda</h3>
                <div className="grid formgrid">
                    <div className="flex flex-wrap gap-8 align-items-end">
                      {/* Filtro Año */}
                      <div className="field">
                        <label htmlFor="filterYear" className="deprati-label font-bold block mb-2">Año</label>
                        <Dropdown
                          id="filterYear"
                          value={filterYear}
                          options={yearsOptions}
                          onChange={(e) => setFilterYear(e.value)}
                          placeholder="Seleccionar Año"
                          className="deprati-dropdown w-12rem"
                        />
                      </div>

                      {/* Filtro Mes */}
                      <div className="field">
                        <label htmlFor="filterMonth" className="deprati-label font-bold block mb-2">Mes</label>
                        <Dropdown
                          id="filterMonth"
                          value={filterMonth}
                          options={months}
                          onChange={(e) => setFilterMonth(e.value)}
                          placeholder="Seleccionar Mes"
                          className="deprati-dropdown w-12rem"
                        />
                      </div>

                      {/* Filtro Marca */}
                      <div className="field">
                        <label htmlFor="filterMarca" className="deprati-label font-bold block mb-2">Marca</label>
                        <Dropdown
                          id="filterMarca"
                          value={filterMarca}
                          options={marcas.map(marca => ({ label: marca, value: marca }))}
                          onChange={(e) => setFilterMarca(e.value)}
                          placeholder="Seleccionar Marca"
                          className="deprati-dropdown w-12rem"
                        />
                      </div>
                      {/* Filtro Fecha */}
                      <div className="field">
                        <label htmlFor="filterDate" className="deprati-label font-bold block mb-2">Fecha Específica</label>
                        <Calendar
                          id="filterDate"
                          value={filterDate}
                          onChange={(e) => setFilterDate(e.value)}
                          dateFormat="dd/mm/yy"
                          placeholder="Seleccione la Fecha"
                          className="deprati-calendar w-14rem"
                          showIcon
                          inputClassName="text-black font-bold"
                        />
                      </div>
                    </div>
                  </div>
                <Divider className="deprati-divider" />
                <div className="deprati-filter-actions flex justify-content-end gap-3 mt-3">
                        <Button 
                        label="Aplicar Filtro" 
                        icon="pi pi-filter" 
                        onClick={handleApplyFilters} 
                        className="p-button-primary p-button-raised deprati-button deprati-button-apply"
                        />
                        <Button 
                          label="Limpiar Filtros" 
                          icon="pi pi-times" 
                          severity="secondary"
                          onClick={handleClearFilters}
                          className="p-button-raised p-button-outlined deprati-button deprati-button-clear"
                        />
                      <Button 
                        label="Descargar Reportes con Filtros" 
                        icon="pi pi-file-excel" 
                        className="p-button-success mr-2" 
                        onClick={downloadFilteredVentasReport}
                        disabled={filteredVentas.length === 0}
                      />
                </div>
            </Card>
          
            <DataTable
              value={filteredVentas} // <- sin slice
              loading={loadingVentas}
              paginator
              rows={paginatorState.rows}
              rowsPerPageOptions={[5, 10, 25, 50]}
              totalRecords={paginatorState.totalRecords}
              first={paginatorState.first}
              onPage={onPageChange}
              paginatorClassName="p-3 deprati-square-paginator"
              paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown CurrentPageReport"
              currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} registros"
              responsiveLayout="scroll"
              emptyMessage="No hay ventas disponibles."
              className="p-datatable-sm"
              showGridlines
              stripedRows
              globalFilter={globalFilter}
              header={
                <div className="deprati-table-header flex flex-wrap gap-2 align-items-center justify-content-between">
                  <h4 className="deprati-title m-0">Listado de Ventas</h4>
                  <span className="deprati-search p-input-icon-left">
                    <i className="pi pi-search" />
                    <InputText
                      value={globalFilter}
                      onChange={(e) => {
                        const value = e.target.value || '';
                        setGlobalFilter(value);

                        if (value) {
                          const lowered = value.toLowerCase();
                          const result = filteredVentas.filter(item =>
                            Object.values(item).some(val =>
                              (typeof val === 'object' && val !== null)
                                ? Object.values(val).some(v2 => v2?.toString().toLowerCase().includes(lowered))
                                : val?.toString().toLowerCase().includes(lowered)
                            )
                          );
                          setFilteredVentas(result);
                        } else {
                         setFilteredVentas(ventas);
                         handleApplyFilters(); // ← re-aplica filtros actuales
                        }
                      }}
                      placeholder="Buscar..."
                      className="deprati-search-input"
                    />
                  </span>
                </div>
              }
            >
              <Column body={selectionBodyTemplate} header={selectionHeaderTemplate} style={{ width: '3em' }} />
              <Column field="anio" header="Año" sortable />
              <Column field="mes" header="Mes" sortable body={(rowData) => monthNames[rowData.mes - 1]} />
              <Column field="dia" header="Día" sortable />
              <Column field="marca" header="Marca" sortable />
              <Column field="cliente.codCliente" header="Código Cliente" sortable 
                body={(rowData) => rowData.cliente ? rowData.cliente.codCliente : "N/A"} />
              <Column field="cliente.nombreCliente" header="Nombre Cliente" sortable
                body={(rowData) => rowData.cliente ? rowData.cliente.nombreCliente : "N/A"} />
              <Column field="codBarra" header="Código Barra" sortable />
              <Column field="codigoSap" header="Código SAP" sortable />
              <Column field="nombreProducto" header="Producto" sortable />
              <Column field="codPdv" header="Código PDV" sortable />
              <Column field="pdv" header="PDV" sortable />
              <Column field="ventaUnidad" header="Unidades" sortable />
              <Column field="ventaDolares" header="Venta $" sortable 
                body={(rowData) => rowData.ventaDolares.toFixed(2)} />
              <Column field="stockUnidad" header="Stock Unidades" sortable 
                body={(rowData) => rowData.stockUnidades.toFixed(0)} />
              <Column field="stockDolares" header="Stock $" sortable 
                body={(rowData) => rowData.stockDolares.toFixed(2)} />
              <Column body={actionBodyTemplate} header="Acciones" style={{ width: '8em' }} />
            </DataTable>

            
            {/* Paginador */}
            <Paginator 
              first={paginatorState.first} 
              rows={paginatorState.rows} 
              totalRecords={paginatorState.totalRecords} 
              rowsPerPageOptions={[5, 10, 20, 50]} 
              onPageChange={onPageChange}
              template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
              className="mt-3"
            />
          </div>
        </div>
      </div>

      {/* Spinner de carga global */}
      {loadingTemplate && (
         <div className="fixed top-0 left-0 w-full h-full flex justify-content-center align-items-center bg-black-alpha-60 z-5">
          <div className="surface-card p-5 border-round shadow-2 text-center">
            <ProgressSpinner style={{ width: '50px', height: '50px' }} />
            <div className="mt-3">Procesando archivo...</div>
          </div>
        </div>
      )}
      
      {/* Modal de edición */}
      <Dialog 
        key={editVenta?.id || 'new'} 
        visible={!!editVenta} 
        onHide={() => setEditVenta(null)}
        modal
        closable={false}
        dismissableMask
        className="deprati-edit-dialog p-fluid surface-overlay shadow-3"
        style={{ width: '70vw', maxWidth: '1200px' }}
        breakpoints={{ '960px': '85vw', '641px': '95vw' }}
        header={
          <div className="flex justify-content-between align-items-center w-full">
            <span className="text-white text-lg font-semibold">Editar Venta</span>
            <Button 
              icon="pi pi-times" 
              className="p-button-rounded p-button-text p-button-plain text-white"
              onClick={() => setEditVenta(null)} 
              aria-label="Cerrar"
            />
          </div>
        }
        footer={
          <div className="flex justify-content-end gap-2 mt-4 pt-4 border-top-1 border-300 bg-gray-100 p-3 border-round-bottom">
            <Button 
              label="Cancelar" 
              icon="pi pi-times" 
              className="p-button-outlined p-button-secondary"
              onClick={() => setEditVenta(null)} 
              type="button"
              style={{ fontSize: '1.05rem', padding: '0.75rem 1.5rem' }}
            />
            <Button 
              label="Guardar"
              icon="pi pi-check"
              onClick={() => actualizarVenta(editVenta)} 
              className="p-button-primary"
              style={{ fontSize: '1.05rem', padding: '0.75rem 1.5rem' }}
            />
          </div>
        }
      >
        {editVenta && (
          <div className="p-4" style={{ fontSize: '1.05rem' }}>
            
            {/* Información General */}
            <div className="p-4 mb-5 border-1 border-round surface-card shadow-2">
              <div className="text-lg font-semibold text-primary mb-3">Información General</div>
              <div className="grid formgrid p-fluid gap-4">
                {['anio', 'mes', 'dia'].map((id) => (
                  <div key={id} className="col-12 md:col-3">
                    <span className="p-float-label w-full">
                      <InputNumber
                        id={id}
                        value={editVenta[id]}
                        onValueChange={(e) => setEditVenta({ ...editVenta, [id]: e.value })}
                        className="w-full"
                        inputStyle={{ fontSize: '1.1rem', padding: '0.85rem', height: '3.2rem' }}
                        useGrouping={false}
                      />
                      <label htmlFor={id} style={{ fontSize: '1rem' }}>{id.charAt(0).toUpperCase() + id.slice(1)}</label>
                    </span>
                  </div>
                ))}
                <div className="col-12 md:col-3">
                  <span className="p-float-label w-full">
                    <Dropdown
                      id="marca"
                      value={editVenta.marca}
                      options={marcas.map((m) => ({ label: m, value: m }))}
                      onChange={(e) => setEditVenta({ ...editVenta, marca: e.value })}
                      placeholder="Seleccionar Marca"
                      className={`w-full custom-dropdown ${!editVenta?.marca ? 'p-invalid' : ''}`}
                    />
                    <label htmlFor="marca" style={{ fontSize: '1rem' }}>Marca</label>
                  </span>
                  {!editVenta?.marca && <small className="p-error">La marca es requerida</small>}
                </div>

                {['codPdv', 'pdv', 'ciudad'].map((id) => (
                  <div key={id} className="col-12 md:col-4">
                    <span className="p-float-label w-full">
                      <InputText
                        id={id}
                        value={editVenta[id] || ''}
                        onChange={(e) => setEditVenta({ ...editVenta, [id]: e.target.value })}
                        className="w-full"
                        inputStyle={{ fontSize: '0.85rem', padding: '0.85rem', height: '3.2rem' }}
                      />
                      <label htmlFor={id} style={{ fontSize: '1rem' }}>{id.toUpperCase()}</label>
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {/* Información de Stock y Ventas */}
            <div className="p-4 mb-5 border-1 border-round surface-card shadow-2">
              <div className="text-lg font-semibold text-primary mb-3">Información de Stock y Ventas</div>
              <div className="grid formgrid p-fluid gap-3">
                {[
                  { id: 'stockDolares', label: 'Stock ($)', mode: 'decimal' },
                  { id: 'stockUnidades', label: 'Stock (U)' },
                  { id: 'ventaDolares', label: 'Venta ($)', mode: 'decimal' },
                  { id: 'ventaUnidad', label: 'Venta (U)' }
                ].map(({ id, label, mode }) => (
                  <div key={id} className="col-12 md:col-4">
                    <span className="p-float-label w-full">
                      <InputNumber
                        id={id}
                        value={editVenta[id]}
                        onValueChange={(e) => setEditVenta({ ...editVenta, [id]: e.value })}
                        className="w-full"
                        inputStyle={{ fontSize: '1.1rem', padding: '0.85rem', height: '3.2rem' }}
                        useGrouping={false}
                        mode={mode}
                        minFractionDigits={mode === 'decimal' ? 2 : 0}
                        maxFractionDigits={mode === 'decimal' ? 2 : 0}
                      />
                      <label htmlFor={id} style={{ fontSize: '1rem' }}>{label}</label>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};
                  
export default Fybeca;