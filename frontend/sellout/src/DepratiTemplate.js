import React, { useEffect, useState, useRef } from "react";
import "./css/deprati.css";
import "primereact/resources/themes/lara-light-indigo/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";
import "primeflex/primeflex.css";
import 'primeicons/primeicons.css';

import * as XLSX from "xlsx";
import { Toast } from "primereact/toast";
import { ProgressSpinner } from "primereact/progressspinner";
import { Calendar } from "primereact/calendar";
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { InputSwitch } from 'primereact/inputswitch';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { Dropdown } from 'primereact/dropdown';
import { FileUpload } from 'primereact/fileupload';
import { Card } from 'primereact/card';
import { Toolbar } from 'primereact/toolbar';
import { Divider } from 'primereact/divider';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';

  // Componente principal de Deprati
  const Deprati = () => {
  const [isSaving, setIsSaving] = useState(false);
  // Estados para gestionar los datos de ventas
  const [ventas, setVentas] = useState([]);
  const [filteredVentas, setFilteredVentas] = useState([]);
  const [loadingVentas, setLoadingVentas] = useState(false);
  const [selectedVentas, setSelectedVentas] = useState([]);
  const [editVenta, setEditVenta] = useState(null);
  const toast = useRef(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  // Estado para mostrar el diálogo de mapeo
  const [mapeoExcelDialogVisible, setMapeoExcelDialogVisible] = useState(false);
  // Archivo seleccionado
  const [selectedFile, setSelectedFile] = useState(null);
  // Agrega este state
  const [rowClick, setRowClick] = useState(true);
  // Mapeo dinámico sin valores por defecto (el usuario los llenará)
  const [mapeoExcel, setMapeoExcel] = useState({
    filaCodPdv: null,
    colCodPdv: null,
    filaPdv: null,
    colPdv: null,
    filaInicioDatos: null,
    colFecha: null,
    colMarca: null,
    colNombreProducto: null,
    colCodBarra: null,
    colInicioPDV: null,
    colFinPDV: null,
  });

  
  const MapeoExcelDialog = () => {
    return (
      <Dialog
        visible={mapeoExcelDialogVisible}
        onHide={() => setMapeoExcelDialogVisible(false)}
        header="Confirmar carga de archivo"
        style={{ width: '30vw' }}
        modal
        closable={false}
        dismissableMask
        footer={
          <div className="flex justify-content-end gap-2">
            <Button
              label="Cancelar"
              icon="pi pi-times"
              onClick={() => {
                setMapeoExcelDialogVisible(false);
                setSelectedFile(null);
              }}
              className="p-button-outlined p-button-secondary"
            />
            <Button
              label="Procesar Archivo"
              icon="pi pi-check"
              onClick={() => {
                setMapeoExcelDialogVisible(false);
                if (selectedFile) {
                  handleUploadWithMapeo(selectedFile);
                }
              }}
              className="p-button-primary"
              disabled={!selectedFile}
            />
          </div>
        }
      >
        <div className="p-3 text-center">
          <i className="pi pi-exclamation-triangle text-3xl text-primary mb-3" />
          <p className="text-xl font-semibold">¿Está seguro que desea subir este archivo?</p>
          <p className="text-sm text-secondary">Se procesarán los datos automáticamente con los encabezados detectados.</p>
        </div>
      </Dialog>
    );
  };


  
  // Estados para filtros
  const [filterYear, setFilterYear] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterMarca, setFilterMarca] = useState("");
  const [filterDate, setFilterDate] = useState(null);
  const [marcas, setMarcas] = useState([]);
  const [globalFilter, setGlobalFilter] = useState('');
  // Estado para paginación
    const [paginatorState, setPaginatorState] = useState({
        first: 0,
        rows: 10,
        page: 0,
        totalRecords: 0
    });
  // Años disponibles para filtrar
  const years = [...new Set(ventas.map(v => v.anio))].sort();
  
  // Meses disponibles para filtrar
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
    { label: 'Diciembre', value: 12 }
  ];
  
  // Cargar datos iniciales
  useEffect(() => {
    loadMarcas();
    loadVentas();
  }, []);
    // Actualizar el total de registros cuando cambian los datos filtrados
    useEffect(() => {
        setPaginatorState(prevState => ({
            ...prevState,
            totalRecords: filteredVentas.length,
            first: 0,
            page: 0
        }));
    }, [filteredVentas]);
    
    // Manejador para cambios en la paginación
    const onPageChange = (event) => {
        setPaginatorState(event);
    };

  /**
   * Carga las ventas desde la API
   * Función independiente para cargar datos de ventas
   */
  const loadVentas = async () => {
    setLoadingVentas(true);
    try {
      const response = await fetch("/api/deprati/venta");
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
    } catch (error) {
      console.error(error);
      showError("Error al cargar ventas");
    } finally {
      setLoadingVentas(false);
    }
  };

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


  /**
   * Muestra mensaje de éxito
   * Componente único para notificaciones de éxito con estilo Deprati
   */
  const showSuccess = (msg) => {
    toast.current.show({
      severity: 'success', 
      summary: 'Éxito', 
      detail: msg, 
      life: 3000,
      className: 'deprati-toast deprati-toast-success'
    });
  };

  /**
   * Muestra mensaje informativo
   * Componente único para notificaciones informativas con estilo Deprati
   */
  const showInfo = (msg) => {
    toast.current.show({
      severity: 'info', 
      summary: 'Información', 
      detail: msg, 
      life: 3000,
      className: 'deprati-toast deprati-toast-info'
    });
  };

  /**
   * Muestra mensaje de advertencia
   * Componente único para notificaciones de advertencia con estilo Deprati
   */
  const showWarn = (msg) => {
    toast.current.show({
      severity: 'warning', 
      summary: 'Advertencia', 
      detail: msg, 
      life: 3000,
      className: 'deprati-toast deprati-toast-warning'
    });
  };

  /**
   * Muestra mensaje de error
   * Componente único para notificaciones de error con estilo Deprati
   */
  const showError = (msg) => {
    toast.current.show({
      severity: 'error', 
      summary: 'Error', 
      detail: msg, 
      life: 3000,
      className: 'deprati-toast deprati-toast-error'
    });
  };

  /**
   * Carga las marcas disponibles
   * Función independiente para obtener marcas desde la API
   */
  const loadMarcas = async () => {
    try {
      const response = await fetch("/api/fybeca/marcas-ventas");
      if (!response.ok) throw new Error("Error al cargar marcas");
      const data = await response.json();
      setMarcas(data);
    } catch (error) {
      console.error(error);
    }
  };

  /**
   * Ejecuta la eliminación masiva de ventas seleccionadas
   * Función independiente para eliminar múltiples registros
   */
  const executeDeleteSelected = async () => {
  const ids = selectedVentas.map(venta => venta.id);
  
    try {
      const response = await fetch("/api/deprati/ventas-forma-masiva", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ids),
      });

      if (!response.ok) throw new Error("Error al eliminar las ventas");

      showSuccess("Ventas eliminadas exitosamente");
      setSelectedVentas([]); // Limpia selección

      await loadVentas();      // Recarga datos
      handleApplyFilters();    // Aplica filtros si hay activos

    } catch (error) {
      console.error(error);
      showError(error.message || "Error al eliminar ventas");
    }
  };


  /**
   * Maneja la confirmación para eliminar ventas seleccionadas
   * Componente único de confirmación con estilo Deprati
   */
  const handleDeleteSelected = () => {
    if (selectedVentas.length === 0) return;
    
    confirmDialog({
      message: `¿Está seguro de eliminar ${selectedVentas.length} venta(s)?`,
      header: 'Confirmación de eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'No, cancelar',
      acceptClassName: 'p-button-danger deprati-confirm-button',
      rejectClassName: 'p-button-secondary deprati-cancel-button',
      className: 'deprati-confirm-dialog',
      closable: false, // 👈 Esto habilita la "X"
      accept: () => executeDeleteSelected()
    });
  };

  /**
 * Aplica los filtros con los valores proporcionados
 * Función para filtrado automático
 */
const applyFilters = (year, month, marca, date) => {
    const filtered = ventas.filter((v) => {
      return (
        (year ? parseInt(year) === v.anio : true) &&
        (month ? parseInt(month) === v.mes : true) &&
        (marca ? marca === v.marca : true) &&
        (date
          ? new Date(v.anio, v.mes - 1, v.dia).toDateString() === date.toDateString()
          : true)
      );
    });
    setFilteredVentas(filtered);
    
    // Opcional: mostrar mensaje solo si hay filtros aplicados
    if (year || month || marca || date) {
      showInfo(`Se encontraron ${filtered.length} registros con los filtros aplicados`);
    }
  };
  
 
  /**
   * Maneja la eliminación de una venta
   * Componente único de confirmación de eliminación con estilo Deprati
   */
  const handleDelete = async (id) => {
    confirmDialog({
      message: '¿Está seguro de eliminar esta venta?',
      header: 'Confirmación de eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'No, cancelar',
      acceptClassName: 'p-button-danger deprati-confirm-button',
      rejectClassName: 'p-button-secondary deprati-cancel-button',
      className: 'deprati-confirm-dialog',
      closable: false, // 👈 Esto habilita la "X"
      accept: async () => {
        try {
          const response = await fetch("/api/deprati/venta/" + id, {
            method: "DELETE",
          });
          if (!response.ok) throw new Error("Error al eliminar la venta");
          loadVentas();
          showInfo("Venta eliminada exitosamente");
        } catch (error) {
          console.error(error);
          showError(error.message || "Error al eliminar la venta");
        }
      }
    });
  };

  /**
   * Calcula el tiempo estimado de carga basado en el tamaño del archivo
   * @param {number} fileSize - Tamaño del archivo en bytes
   * @returns {number} - Tiempo estimado en milisegundos
   */
  const calculateUploadTime = (fileSize) => {
    // Convertir bytes a MB
    const fileSizeMB = fileSize / (1024 * 1024);
    
    // Velocidad de carga estimada (MB por segundo) - Reducida para ser más conservadora
    const uploadSpeedMBps = 0.5; // Estimación más conservadora
    
    // Tiempo base para procesamiento del servidor (ms) - Aumentado
    const baseProcessingTime = 10000; // 10 segundos base
    
    // Tiempo adicional por MB para procesamiento del servidor - Aumentado
    const processingTimePerMB = 1000; // 1 segundo por MB
    
    // Calcular tiempo de carga en milisegundos
    const uploadTimeMs = (fileSizeMB / uploadSpeedMBps) * 1000;
    
    // Calcular tiempo de procesamiento en milisegundos
    const processingTimeMs = baseProcessingTime + (fileSizeMB * processingTimePerMB);
    
    // Tiempo total estimado con factor de seguridad (1.5x)
    const totalEstimatedTime = (uploadTimeMs + processingTimeMs) * 1.5;
    
    // Establecer un tiempo mínimo de 15 segundos y máximo de 15 minutos
    return Math.min(Math.max(totalEstimatedTime, 15000), 900000);
  };

  /**
   * Maneja la carga de archivos Excel
   * Función independiente para procesar archivos de ventas
   */
  const handleUpload = (file) => {
    // Verificar que el archivo sea válido
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      showError("El archivo debe ser de tipo Excel (.xlsx o .xls)");
      return;
    }

    // Verificar tamaño del archivo (máximo 10MB)
    if (file.size > 10000000) {
      showError("El archivo es demasiado grande. Tamaño máximo: 10MB");
      return;
    }
    
    // Guardar el archivo seleccionado y mostrar el diálogo de configuración
    setSelectedFile(file);
    setMapeoExcelDialogVisible(true);
  };

  /**
   * Procesa el archivo Excel con la configuración de mapeo
   */
  const handleUploadWithMapeo = async (file) => {
    setLoadingTemplate(true);

    const formData = new FormData();
    formData.append("file", file);

    // Función para agregar parámetros numéricos
    const appendNumberParam = (key, value) => {
        if (value !== undefined && value !== null && value !== "") {
            const numValue = parseInt(value);
            if (!isNaN(numValue)) {
                formData.append(key, numValue);
                console.log(`Param: ${key} = ${numValue} (tipo: ${typeof numValue})`);
            }
        }
    };

    // Agregar todos los parámetros esperados por el backend
    appendNumberParam("filaCodPdv", mapeoExcel.filaCodPdv);
    appendNumberParam("columnaCodPdv", mapeoExcel.colCodPdv);
    appendNumberParam("filaPdv", mapeoExcel.filaPdv);
    appendNumberParam("columnaPdv", mapeoExcel.colPdv);
    appendNumberParam("filaInicioDatos", mapeoExcel.filaInicioDatos);
    appendNumberParam("columnaFecha", mapeoExcel.colFecha);
    appendNumberParam("columnaMarca", mapeoExcel.colMarca);
    appendNumberParam("columnaNombreProducto", mapeoExcel.colNombreProducto);
    appendNumberParam("columnaCodBarra", mapeoExcel.colCodBarra);
    appendNumberParam("columnaInicioPDV", mapeoExcel.colInicioPDV);
    appendNumberParam("columnaFinPDV", mapeoExcel.colFinPDV);

    // Mostrar el contenido del FormData
    console.log("Contenido de FormData:");
    for (const [key, value] of formData.entries()) {
        console.log(`${key}: ${value} (tipo: ${typeof value})`);
    }

    // Calcular tiempo estimado
    const estimatedTime = calculateUploadTime(file.size);
    const estimatedMinutes = Math.floor(estimatedTime / 60000);
    const estimatedSeconds = Math.floor((estimatedTime % 60000) / 1000);
    const timeMessage = estimatedMinutes > 0
        ? `aproximadamente ${estimatedMinutes} minutos y ${estimatedSeconds} segundos`
        : `aproximadamente ${estimatedSeconds} segundos`;

    const toastId = toast.current.show({
        severity: 'info',
        summary: 'Cargando archivo',
        detail: `Subiendo ${file.name}. Tiempo estimado: ${timeMessage}. Por favor espere...`,
        life: 0,
        sticky: true,
        className: 'deprati-toast deprati-toast-info deprati-toast-persistent'
    });

    try {
        console.log("Iniciando carga del archivo:", file.name);
        console.log("Configuración de mapeo:", mapeoExcel);

        const response = await fetch("/api/deprati/subir-archivos-motor-maping", {
            method: "POST",
            body: formData,
            signal: AbortSignal.timeout(1800000) // 30 minutos de timeout
        });

        console.log("Respuesta del servidor:", response.status, response.statusText);
       

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Respuesta con error:", errorText);
            toast.current.clear(toastId);
            showError("Error al cargar ventas");

            try {
                const errorJson = JSON.parse(errorText);
                throw new Error(errorJson.message || `Error ${response.status}: ${response.statusText}`);
            } catch (e) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
        }

        const result = await response.json();
        console.log("Resultado:", result);
        toast.current.clear(toastId);
        showSuccess("Archivo cargado exitosamente");
        if (result.codigosNoEncontrados && result.codigosNoEncontrados.length > 0) {
          toast.current.clear();
          toast.current.show({
            severity: 'warn',
            summary: 'Códigos no encontrados',
            detail: (
              <div className="flex flex-column gap-3">
                <span>
                  Se detectaron <b>{result.codigosNoEncontrados.length}</b> códigos no encontrados.
                </span>
                <Button
                  label="Guardar TXT"
                  icon="pi pi-save"
                  className="p-button-sm p-button-warning"
                  style={{
                    whiteSpace: 'nowrap',
                    padding: '0.5rem 2.5rem'
                  }}
                  onClick={() => promptSaveCodigosNoEncontrados(result.codigosNoEncontrados)}
                />
              </div>
            ),
            sticky: true,
            className: 'deprati-toast deprati-toast-warning',
            contentClassName: 'd-flex align-items-center justify-content-between'
          });
        }


        loadVentas();
    } catch (error) {
        console.error("Error en la carga:", error);
        toast.current.clear(toastId);

        if (error.name === 'AbortError') {
            showError("Tiempo de carga excedido. Puede que el servidor aún esté procesando.");
        } else if (error.message.includes("Failed to fetch")) {
            showError("No se pudo conectar con el servidor. Verifica la conexión.");
        } else {
            showError(error.message || "Error inesperado al subir archivo");
        }
    } finally {
        const cooldownTime = Math.min(Math.max(file.size / (1024 * 1024) * 200, 10000), 30000);
        setTimeout(() => {
            setLoadingTemplate(false);
            loadVentas();
        }, cooldownTime);
    }
  };
    const promptSaveCodigosNoEncontrados = async (codigos) => {
      try {
        if (!window.showSaveFilePicker) {
          // Fallback para navegadores que no soportan showSaveFilePicker
          const blob = new Blob([codigos.join("\n")], { type: "text/plain" });
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = "codigos_no_encontrados.txt";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          return;
        }

        const opts = {
          suggestedName: "codigos_no_encontrados.txt",
          types: [{
            description: "Archivo de texto",
            accept: { "text/plain": [".txt"] }
          }]
        };

        const handle = await window.showSaveFilePicker(opts);
        const writable = await handle.createWritable();
        await writable.write(codigos.join("\n"));
        await writable.close();

        showSuccess("Archivo guardado correctamente");
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error("Error al guardar el archivo:", err);
          showError("No se pudo guardar el archivo.");
        }
      }
    };


      /**
       * Aplica los filtros seleccionados
       * Función independiente para filtrar datos de ventas
       */
      const handleApplyFilters = () => {
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
              // Crear una fecha a partir de los componentes año, mes y día de la venta
              const ventaDate = new Date(v.anio, v.mes - 1, v.dia); // Mes es 0-indexado en JavaScript
              
              // Comparar año, mes y día individualmente para evitar problemas con horas/minutos
              return (
                ventaDate.getFullYear() === selectedDate.getFullYear() &&
                ventaDate.getMonth() === selectedDate.getMonth() &&
                ventaDate.getDate() === selectedDate.getDate()
              );
            });
          }
      
        setFilteredVentas(filtered);
      // Mostrar mensaje con el resultado del filtrado
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
    setFilteredVentas(ventas);
    setGlobalFilter('');
  };

  /**
   * Maneja la edición de una venta
   * Función independiente para iniciar edición de registro
   */
  const handleEdit = (venta) => {
    if (editVenta !== null) return; // Evita múltiples aperturas
    if (!venta || !venta.id) {
        showError("No se puede editar: venta inválida");
        return;
    }
    setEditVenta({...venta});
  };

  /**
   * Maneja el envío del formulario de edición
   * Función independiente para actualizar registro de venta
   */
  const handleFormSubmit = async (e) => {
  e.preventDefault();

  if (!editVenta || !editVenta.id) {
    showError("No se puede editar la venta: datos inválidos");
    return;
  }

  setIsSaving(true);

  try {
      const response = await fetch(`/api/deprati/venta/${editVenta.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editVenta),
      });

      if (!response.ok) throw new Error("Error al editar la venta");

      setEditVenta(null); // Cierra el formulario
      showSuccess("Venta actualizada exitosamente");

      await loadVentas();         // Recarga datos
      handleApplyFilters();       // Reaplica filtros si hay

    } catch (error) {
      console.error(error);
      showError(error.message || "Error al editar la venta");
    } finally {
      setIsSaving(false);
    }
  };



  // Renderiza la barra de herramientas izquierda
  const leftToolbarTemplate = () => {
    return (
        <div className="deprati-toolbar-left flex flex-wrap align-items-center gap-3">
            <Button
                label="Importar Excel"
                icon="pi pi-file-excel"
                className="p-button-primary p-button-raised deprati-button deprati-import-excel-button"
                onClick={() => {
                    document.getElementById('fileUploadInput').click();
                }}
            />
            <input
                id="fileUploadInput"
                type="file"
                accept=".xlsx,.xls"
                style={{ display: 'none' }}
                onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                        const file = e.target.files[0];
                        handleUpload(file);
                        e.target.value = '';
                    }
                }}
            />
        </div>
    );
  };

    /**
   * Descarga un reporte Excel con los datos filtrados actualmente
   * Función independiente para exportación de datos filtrados
   */
    const downloadFilteredReport = () => {
  if (!filteredVentas.length) {
    showWarn("No hay datos filtrados para generar el reporte.");
    return;
  }

  // Crear hoja de cálculo
    const ws = XLSX.utils.json_to_sheet(filteredVentas.map(item => ({
      'Año': item.anio,
      'Mes': item.mes,
      'Día': item.dia,
      'Marca': item.marca,
      'Código PDV': item.codPdv,
      'PDV': item.pdv,
      'Ciudad': item.ciudad,
      'Producto': item.nombreProducto,
      'Código Barra': item.codBarra,
      'Stock ($)': item.stockDolares,
      'Stock (U)': item.stockUnidades,
      'Venta ($)': item.ventaDolares,
      'Venta (U)': item.ventaUnidad
    })));

    // Aplicar formato numérico a columnas específicas
    const numberColumns = ['J', 'K', 'L', 'M']; // Columnas de Stock/Venta
    for (let i = 2; i <= filteredVentas.length + 1; i++) {
      numberColumns.forEach(col => {
        const cell = ws[`${col}${i}`];
        if (cell) {
          cell.z = '#,##0.00';
        }
      });
    }

    // Crear libro y guardar archivo
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte Filtrado");

    const today = new Date();
    const dateStr = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;
    const fileName = `Reporte_Filtrado_Deprati_${dateStr}.xlsx`;

    XLSX.writeFile(wb, fileName);
    showSuccess(`Se ha generado el reporte con ${filteredVentas.length} registros.`);
  };
 
  /**
   * Exporta los datos filtrados a Excel
   * Función independiente para exportación de datos
   */
  const exportToExcel = () => {
  if (!filteredVentas.length) {
    showWarn("No hay datos para exportar.");
    return;
  }

  // Generar hoja con los datos originales (sin toFixed)
  const exportData = filteredVentas.map(item => ({
    'Año': item.anio,
    'Mes': item.mes,
    'Día': item.dia,
    'Marca': item.marca,
    'Código PDV': item.codPdv,
    'PDV': item.pdv,
    'Ciudad': item.ciudad,
    'Producto': item.nombreProducto,
    'Código Barra': item.codBarra,
    'Stock ($)': item.stockDolares,
    'Stock (U)': item.stockUnidades,
    'Venta ($)': item.ventaDolares,
    'Venta (U)': item.ventaUnidad
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);

  // Aplicar formato numérico a columnas J, K, L, M (columnas 10 a 13)
  const numberColumns = ['J', 'K', 'L', 'M'];
  for (let i = 2; i <= exportData.length + 1; i++) {
    numberColumns.forEach(col => {
      const cellRef = `${col}${i}`;
      if (ws[cellRef]) {
        ws[cellRef].z = "#,##0.00";
      }
    });
  }

  const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ventas Deprati");

    XLSX.writeFile(wb, "Reporte_Ventas_Deprati.xlsx");

    showSuccess(`Se exportaron ${filteredVentas.length} registros a Excel`);
  };

  
  /**
   * Renderiza la barra de herramientas derecha
   * Componente único para acciones de exportación con estilo Deprati
   */
  const rightToolbarTemplate = () => {
      return (
          <div className="deprati-toolbar-right flex flex-wrap align-items-center justify-content-end gap-3">
              <Button
                  label="Descargar Template"
                  icon="pi pi-download"
                  className="p-button-raised p-button-warning deprati-button deprati-button-warning"
                  onClick={() => {
                      const link = document.createElement('a');
                      link.href = '/TEMPLATE_DEPRATI.xlsx';
                      link.download = 'TEMPLATE VENTAS DEPRATI.xlsx';
                      link.click();
                  }}
              />
              <Button
                  label="Exportar Excel"
                  icon="pi pi-file-excel"
                  className="p-button-success p-button-raised deprati-button deprati-button-export"
                  onClick={exportToExcel}
              />
              <Button
                  label="Reporte de Ventas Con Filtro"
                  icon="pi pi-file-excel" 
                    onClick={downloadFilteredReport}
                    className="p-button-success p-button-raised deprati-button"
                    disabled={filteredVentas.length === 0} 
                                
              />
              <Button
                  label="Eliminar Seleccionados"
                  icon="pi pi-trash"
                  className=" deprati-button deprati-delete-selected-button"
                  disabled={!selectedVentas.length}
                  onClick={handleDeleteSelected}
              />
          </div>
      );
  };

  const downloadFilteredVentas = () => {
    if (!filteredVentas.length) {
      showWarn("No hay ventas filtradas para descargar.");
      return;
    }
  
    const headers = Object.keys(filteredVentas[0]);
    const csvRows = [
      headers.join(','), // encabezados
      ...filteredVentas.map(row =>
        headers.map(field => `"${String(row[field]).replace(/"/g, '""')}"`).join(',')
      )
    ];
  
    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
  
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "ventas_filtradas.csv");
    document.body.appendChild(link); // Requerido para Firefox
    link.click();
    document.body.removeChild(link);
  };
  
  const handleAplicarFiltro = () => {
    // Construir filtros basados en los valores seleccionados
    const filtros = {};
    
    if (filterYear) filtros.anio = parseInt(filterYear);
    if (filterMonth) filtros.mes = parseInt(filterMonth);
    if (filterMarca) filtros.marca = filterMarca;
    if (filterDate) filtros.fecha = filterDate;
    
    // Verificar si hay al menos un filtro seleccionado
    if (Object.keys(filtros).length === 0) {
      showWarn("Por favor seleccione al menos un filtro para aplicar.");
      return;
    }

    // Aplicar los filtros
    const resultado = ventas.filter(venta => {
      let cumpleFiltros = true;
      
      if (filtros.anio !== undefined && venta.anio !== filtros.anio) {
        cumpleFiltros = false;
      }
      
      if (filtros.mes !== undefined && venta.mes !== filtros.mes) {
        cumpleFiltros = false;
      }
      
      if (filtros.marca !== undefined && venta.marca !== filtros.marca) {
        cumpleFiltros = false;
      }
      
      if (filtros.fecha !== undefined) {
        const fechaVenta = new Date(venta.anio, venta.mes - 1, venta.dia);
        const fechaFiltro = new Date(filtros.fecha);
        
        if (fechaVenta.toDateString() !== fechaFiltro.toDateString()) {
          cumpleFiltros = false;
        }
      }
      
      return cumpleFiltros;
    });

    // Actualizar los resultados y mostrar mensaje
    setFilteredVentas(resultado);
    
    if (resultado.length === 0) {
      showInfo("No se encontraron datos para los filtros seleccionados.");
    } else {
      showSuccess(`Se encontraron ${resultado.length} registros con los filtros aplicados.`);
    }
  };

  /**
   * Renderiza el encabezado de la tabla
   * Componente único para encabezado con estilo Deprati
   */
  const renderHeader = () => {
    return (
        <div className="deprati-table-header flex flex-wrap gap-2 align-items-center justify-content-between">
            <h4 className="deprati-title m-0">Gestión de Ventas Deprati</h4>
            <span className="deprati-search p-input-icon-left">
                <i className="pi pi-search" />
                <InputText
                    value={globalFilter}
                    onChange={(e) => {
                        const value = e.target.value;
                        setGlobalFilter(value);
                        
                        // Filtrar los datos
                        if (value) {
                            const filtered = ventas.filter(item => {
                                return Object.values(item).some(val =>
                                    val?.toString().toLowerCase().includes(value.toLowerCase())
                                );
                            });
                            setFilteredVentas(filtered);
                        } else {
                            setFilteredVentas(ventas);
                        }
                    }}
                    placeholder="Buscar..."
                    className="deprati-search-input"
                />
            </span>
        </div>
    );
};

/**
 * Texto para el pie de la tabla
 * Componente único para footer con estilo Deprati
 */
const footer = `Total de ${filteredVentas ? filteredVentas.length : 0} ventas`;

  /**
   * Renderiza las acciones para cada fila
   * Componente único para botones de acción con estilo Deprati
   */
  const actionBodyTemplate = (rowData) => {
    return (
        <div className="deprati-row-actions flex gap-2 justify-content-center">
            <Button
                icon="pi pi-pencil"
                className="p-button-rounded p-button-outlined p-button-info deprati-action-button deprati-edit-button"
                onClick={() => handleEdit(rowData)}
                tooltip="Editar"
                tooltipOptions={{ position: 'top' }}
            />
            <Button
                icon="pi pi-trash"
                className="p-button-rounded p-button-outlined p-button-danger deprati-action-button deprati-delete-button"
                onClick={() => handleDelete(rowData.id)}
                tooltip="Eliminar"
                tooltipOptions={{ position: 'top' }}
            />
        </div>
    );
  };
  
  return (
    <div className="deprati-layout-wrapper">
        <Toast ref={toast} position="top-right" className="toast-on-top" />
        <ConfirmDialog />
        {loadingTemplate && (
            <div className="deprati-loader-overlay">
                <ProgressSpinner className="deprati-spinner" />
                <div className="mt-3 text-white font-bold deprati-loading-text">Procesando archivo...</div>
            </div>
        )}

        {/* Diálogo de configuración de mapeo Excel */}
        <MapeoExcelDialog />

        <div className="deprati-card card">
            <h1 className="deprati-main-title text-center text-primary my-4">Ventas Deprati</h1>
            
            <Toolbar
                className="deprati-toolbar mb-4"
                left={leftToolbarTemplate}
                right={rightToolbarTemplate}
            />

            <Card className="deprati-filter-card mb-4">
                <h3 className="deprati-section-title text-primary mb-3">Filtros de Búsqueda</h3>
                <div className="grid formgrid">
                    <div className="col-12 md:col-3 field">
                        <label htmlFor="filterYear" className="deprati-label font-bold block mb-2">Año</label>
                        <Dropdown
                            id="filterYear"
                            value={filterYear}
                            options={years.map(year => ({label: year.toString(), value: year}))}
                            onChange={(e) => {
                                setFilterYear(e.value);
                                }}
                            placeholder="Seleccionar Año"
                            className="deprati-dropdown w-full"
                        />
                    </div>
                    <div className="col-12 md:col-3 field">
                        <label htmlFor="filterMonth" className="deprati-label font-bold block mb-2">Mes</label>
                        <Dropdown
                            id="filterMonth"
                            value={filterMonth}
                            options={months}
                            onChange={(e) => {
                                setFilterMonth(e.value);
                            }}
                            placeholder="Seleccionar Mes"
                            className="deprati-dropdown w-full"
                        />
                    </div>
                    <div className="col-12 md:col-3 field">
                        <label htmlFor="filterMarca" className="deprati-label font-bold block mb-2">Marca</label>
                        <Dropdown
                            id="filterMarca"
                            value={filterMarca}
                            options={marcas.map(marca => ({label: marca, value: marca}))}
                            onChange={(e) => {
                                setFilterMarca(e.value);
                            }}
                            placeholder="Seleccionar Marca"
                            className="deprati-dropdown w-full"
                        />
                    </div>
                    <div className="col-12 md:col-3 field">
                        <label htmlFor="filterDate" className="deprati-label font-bold block mb-2">Fecha Específica</label>
                        <Calendar
                            id="filterDate"
                            value={filterDate}
                            onChange={(e) => {
                                setFilterDate(e.value);
                                }}
                            dateFormat="dd/mm/yy"
                            placeholder="Seleccione la Fecha"
                            className="deprati-calendar w-full"
                            showIcon
                            inputClassName="text-black font-bold"
                        />
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
                        <Button label="Limpiar Filtros" icon="pi pi-times" severity="secondary" onClick={() => {
                            setFilterYear("");
                            setFilterMonth("");
                            setFilterMarca("");
                            setFilteredVentas([]);
                            setFilterDate("");
                        }} 
                        className="p-button-raised p-button-outlined deprati-button deprati-button-clear"
                        />
                </div>
            </Card>

           <div className="card">
            <DataTable
                value={filteredVentas}
                paginator
                rows={paginatorState.rows}
                rowsPerPageOptions={[5, 10, 25, 50]}
                totalRecords={paginatorState.totalRecords}
                first={paginatorState.first}
                onPage={onPageChange}
                paginatorClassName="p-3 deprati-square-paginator"
                paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown CurrentPageReport"
                currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} registros"
                dataKey="id"
                selectionMode={rowClick ? null : 'checkbox'}
                selection={selectedVentas}
                onSelectionChange={(e) => {
                    if (e.value.length > 5000) {
                        showWarn("Solo puede seleccionar un máximo de 5 registros para eliminar.");
                        setSelectedVentas(e.value.slice(0, 5));
                    } else {
                        setSelectedVentas(e.value);
                    }
                }}
                selectionPageOnly={false}
                responsiveLayout="scroll"
                stripedRows
                showGridlines
                header={renderHeader}
                footer={footer}
                emptyMessage="No se encontraron registros"
                loading={loadingVentas}
                className="p-datatable-sm"
                tableStyle={{ minWidth: '50rem' }}
                resizableColumns
                columnResizeMode="fit"
            >
               <Column selectionMode="multiple" headerStyle={{ width: '3rem' }} headerCheckbox />


                {/* Tus demás columnas */}
                <Column field="anio" header="Año" sortable style={{ width: '8%' }} />
                <Column field="mes" header="Mes" sortable style={{ width: '8%' }} />
                <Column field="dia" header="Día" sortable style={{ width: '8%' }} />
                <Column field="marca" header="Marca" sortable style={{ width: '10%' }} />
                <Column field="codPdv" header="Código PDV" sortable style={{ width: '10%' }} />
                <Column field="pdv" header="PDV" sortable style={{ width: '12%' }} />
                <Column field="ciudad" header="Ciudad" sortable style={{ width: '10%' }} />
                <Column field="nombreProducto" header="Producto" sortable style={{ width: '15%' }} />
                <Column field="codBarra" header="Código Barra" sortable style={{ width: '10%' }} />
                <Column
                    field="stockDolares"
                    header="Stock ($)"
                    sortable
                    body={(rowData) => rowData.stockDolares !== undefined ? rowData.stockDolares.toFixed(2) : "0.00"}
                    style={{ width: '10%' }}
                />
                <Column
                    field="stockUnidades"
                    header="Stock (U)"
                    sortable
                    body={(rowData) => rowData.stockUnidades !== undefined ? rowData.stockUnidades.toFixed(0) : "0"}
                    style={{ width: '10%' }}
                />
                <Column
                    field="ventaDolares"
                    header="Venta ($)"
                    sortable
                    body={(rowData) => rowData.ventaDolares !== undefined ? rowData.ventaDolares.toFixed(2) : "0.00"}
                    style={{ width: '10%' }}
                />
                <Column
                    field="ventaUnidad"
                    header="Venta (U)"
                    sortable
                    body={(rowData) => rowData.ventaUnidad !== undefined ? rowData.ventaUnidad.toFixed(0) : "0"}
                    style={{ width: '10%' }}
                />
                <Column
                    body={actionBodyTemplate}
                    exportable={false}
                    style={{ width: '8%' }}
                    header="Acciones"
                />
            </DataTable>
          </div>

          <Dialog 
            key={editVenta?.id || 'new'} 
            visible={editVenta !== null}
            onHide={() => setEditVenta(null)}
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
            className="deprati-edit-dialog p-fluid surface-overlay shadow-3"
            style={{ width: '70vw', maxWidth: '1200px' }}
            modal
            closable={false}
            dismissableMask
            breakpoints={{ '960px': '85vw', '641px': '95vw' }}
          >
            <form onSubmit={handleFormSubmit} className="deprati-form p-4" style={{ fontSize: '1.05rem' }}>

              {/* Información General */}
              <div className="p-4 mb-5 border-1 border-round surface-card shadow-2">
                <div className="text-lg font-semibold text-primary mb-3">Información General</div>
                <div className="grid formgrid p-fluid gap-4">
                  {[
                    { id: 'anio', label: 'Año', value: editVenta?.anio },
                    { id: 'mes', label: 'Mes', value: editVenta?.mes },
                    { id: 'dia', label: 'Día', value: editVenta?.dia }
                  ].map((field) => (
                    <div key={field.id} className="col-12 md:col-3">
                      <span className="p-float-label w-full">
                        <InputNumber
                          id={field.id}
                          value={field.value}
                          onValueChange={(e) => setEditVenta({ ...editVenta, [field.id]: e.value })}
                          className="w-full"
                          inputStyle={{ fontSize: '1.1rem', padding: '0.85rem', height: '3.2rem' }}
                          useGrouping={false}
                        />
                        <label htmlFor={field.id} style={{ fontSize: '1rem' }}>{field.label}</label>
                      </span>
                    </div>
                  ))}
                  <div className="col-12 md:col-3">
                    <span className="p-float-label w-full">
                      <InputText
                        id="marca"
                        value={editVenta?.marca}
                        className={`w-full ${!editVenta?.marca ? 'p-invalid' : ''}`}
                        onChange={(e) => setEditVenta({ ...editVenta, marca: e.target.value })}
                        inputStyle={{ fontSize: '1.1rem', padding: '0.85rem', height: '3.2rem' }}
                      />
                      <label htmlFor="marca" style={{ fontSize: '1rem' }}>Marca</label>
                    </span>
                    {!editVenta?.marca && <small className="p-error">La marca es requerida</small>}
                  </div>
                  {[
                    { id: 'codPdv', label: 'Código PDV' },
                    { id: 'pdv', label: 'PDV' },
                    { id: 'ciudad', label: 'Ciudad' }
                  ].map((field) => (
                    <div key={field.id} className="col-12 md:col-4">
                      <span className="p-float-label w-full">
                        <InputText
                          id={field.id}
                          value={editVenta?.[field.id]}
                          onChange={(e) => setEditVenta({ ...editVenta, [field.id]: e.target.value })}
                          className="w-full"
                          inputStyle={{ fontSize: '1.1rem', padding: '0.85rem', height: '3.2rem' }}
                        />
                        <label htmlFor={field.id} style={{ fontSize: '1rem' }}>{field.label}</label>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Información de Producto */}
              <div className="p-4 mb-5 border-1 border-round surface-card shadow-2">
                <div className="text-lg font-semibold text-primary mb-3">Información de Producto</div>
                <div className="grid formgrid p-fluid gap-3">
                  <div className="col-12">
                    <span className="p-float-label w-full">
                      <InputText
                        id="nombreProducto"
                        value={editVenta?.nombreProducto}
                        onChange={(e) => setEditVenta({ ...editVenta, nombreProducto: e.target.value })}
                        className="w-full"
                        inputStyle={{ fontSize: '1.1rem', padding: '0.85rem', height: '3.2rem' }}
                      />
                      <label htmlFor="nombreProducto" style={{ fontSize: '1rem' }}>Producto</label>
                    </span>
                  </div>
                  <div className="col-12 md:col-6">
                    <span className="p-float-label w-full">
                      <InputText
                        id="codBarra"
                        value={editVenta?.codBarra}
                        onChange={(e) => setEditVenta({ ...editVenta, codBarra: e.target.value })}
                        className="w-full"
                        inputStyle={{ fontSize: '1.1rem', padding: '0.85rem', height: '3.2rem' }}
                      />
                      <label htmlFor="codBarra" style={{ fontSize: '1rem' }}>Código de Barra</label>
                    </span>
                  </div>
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
                  ].map((field) => (
                    <div key={field.id} className="col-12 md:col-4">
                      <span className="p-float-label w-full">
                        <InputNumber
                          id={field.id}
                          value={editVenta?.[field.id]}
                          onValueChange={(e) => setEditVenta({ ...editVenta, [field.id]: e.value })}
                          className="w-full"
                          inputStyle={{ fontSize: '1.1rem', padding: '0.85rem', height: '3.2rem' }}
                          mode={field.mode}
                          minFractionDigits={field.mode === 'decimal' ? 2 : undefined}
                        />
                        <label htmlFor={field.id} style={{ fontSize: '1rem' }}>{field.label}</label>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-content-end gap-2 mt-4 pt-4 border-top-1 border-300 bg-gray-100 p-3 border-round-bottom">
                <Button 
                  label="Cancelar" 
                  icon="pi pi-times" 
                  onClick={() => setEditVenta(null)} 
                  className="p-button-outlined p-button-secondary"
                  type="button"
                  style={{ fontSize: '1.05rem', padding: '0.75rem 1.5rem' }}
                />
                <Button 
                  label={isSaving ? "Guardando..." : "Guardar"}
                  icon={isSaving ? "pi pi-spin pi-spinner" : "pi pi-check"}
                  disabled={isSaving}
                  type="submit"
                  autoFocus
                  className="p-button-primary"
                  style={{ fontSize: '1.05rem', padding: '0.75rem 1.5rem' }}
                />
              </div>
            </form>
          </Dialog>
        </div>
      </div>
    );
  };
export default Deprati;