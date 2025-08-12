package com.manamer.backend.business.sellout.service;

import com.manamer.backend.business.sellout.models.Cliente;
import com.manamer.backend.business.sellout.models.Producto;
import com.manamer.backend.business.sellout.models.Venta;
import com.manamer.backend.business.sellout.repositories.VentaRepository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import jakarta.persistence.NonUniqueResultException;
import jakarta.persistence.Query;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.BufferedWriter;
import java.io.File;
import java.io.IOException;
import java.nio.file.StandardOpenOption;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.nio.file.Paths;
import java.nio.file.Files;

import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import java.nio.file.Path;

import java.io.InputStream;
import java.util.Map;
import java.util.Date;
import java.time.ZoneId;

import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Row;

@Service
public class VentaService {

    private final VentaRepository ventaRepository;
    private final EntityManager entityManager;

    @Autowired
    public VentaService(VentaRepository ventaRepository, EntityManager entityManager) {
        this.ventaRepository = ventaRepository;
        this.entityManager = entityManager;
    }
    public boolean cargarDatosDeProducto(Venta venta, Set<String> codigosNoEncontrados) {
        String codItem = venta.getCodBarra();

        if (codItem == null || codItem.trim().isEmpty()) {
            System.out.println("El código de item no puede ser nulo o vacío");
            return false;
        }

        codItem = codItem.trim();

        String queryStr = "SELECT p.cod_Barra_Sap "
                         + "FROM SELLOUT.dbo.producto p "
                         + "WHERE p.cod_Item = :codItem";

        Query query = entityManager.createNativeQuery(queryStr);
        query.setParameter("codItem", codItem);

        try {
            List<String> codBarraSapList = query.getResultList();

            if (codBarraSapList.isEmpty()) {
                codigosNoEncontrados.add(codItem); // o codBarra
                return false;
            }

            // Manejar múltiples resultados seleccionando el primero
            String codBarraSap = codBarraSapList.get(0);
            venta.setCodBarra(codBarraSap.trim());

            // Consulta SQL para obtener los datos del producto
            queryStr = "SELECT c.id AS ClienteID, c.cod_Cliente, c.nombre_Cliente, c.ciudad, c.codigo_Proveedor, "
                     + "p.id AS IdProducto, p.cod_Item, p.cod_Barra_Sap, sapProd.CodProd, sapProd.CodBarra, "
                     + "sapProd.Descripcion AS DescripcionProducto, sapProd.Marca "
                     + "FROM SELLOUT.dbo.producto p "
                     + "LEFT JOIN SAPHANA..CG3_360CORP.SAP_Prod sapProd ON p.cod_Barra_Sap = sapProd.CodBarra "
                     + "CROSS JOIN (SELECT TOP 1 * FROM SELLOUT.dbo.cliente) c "
                     + "WHERE sapProd.CodBarra = :codBarraSap";

            query = entityManager.createNativeQuery(queryStr);
            query.setParameter("codBarraSap", codBarraSap);

            List<Object[]> results = query.getResultList();
            
            if (results.isEmpty()) {
                guardarCodigoNoEncontrado(codItem);
                return false;
            }

            Object[] result = results.get(0); // Tomar el primer resultado válido

            if (result.length == 12) {
                venta.setCliente(new Cliente());
                venta.getCliente().setId(((Number) result[0]).longValue());
                venta.getCliente().setCodCliente((String) result[1]);
                venta.getCliente().setNombreCliente((String) result[2]);
                venta.getCliente().setCiudad((String) result[3]);
                venta.getCliente().setCodigoProveedor((String) result[4]);

                venta.setProducto(new Producto());
                venta.getProducto().setId(((Number) result[5]).longValue());
                venta.getProducto().setCodItem((String) result[6]);
                venta.getProducto().setCodBarraSap((String) result[7]);

                venta.setCodigoSap((String) result[8]);
                venta.setCodBarra((String) result[9]);
                venta.setDescripcion((String) result[10]);
                venta.setNombreProducto((String) result[10]);
                venta.setMarca((String) result[11]);

                return true;
            }

        } catch (NoResultException e) {
            guardarCodigoNoEncontrado(codItem);
            return false;
        } catch (NonUniqueResultException e) {
            System.out.println("Advertencia: Se encontraron múltiples resultados para el código de item: " + codItem);
            guardarCodigoNoEncontrado(codItem);
            return false;
        }

        return false;
    }
    
     /**
     * Método exclusivo para Deprati que busca información usando el cod_Barra directamente.
     * Se diferencia de Fybeca que usa cod_Item como base.
     */
    public boolean cargarDatosDeProductoDeprati(Venta venta,Set<String> codigosNoEncontrados) {
        String codBarra = venta.getCodBarra();

        // ⚠️ Validación inicial
        if (codBarra == null || codBarra.trim().isEmpty()) {
            System.out.println("⚠️ El código de barra no puede ser nulo o vacío");
            return false;
        }

        codBarra = codBarra.trim();

        try {
            // 🔍 PRIMER QUERY: Verificar existencia y obtener cod_Barra_Sap desde producto
            String queryStr = "SELECT p.cod_Barra_Sap " +
                            "FROM SELLOUT.dbo.producto p " +
                            "WHERE p.cod_Barra_Sap = :codBarra";

            Query query = entityManager.createNativeQuery(queryStr);
            query.setParameter("codBarra", codBarra);
            List<String> codBarraSapList = query.getResultList();

            // Si no existe, se guarda en log de no encontrados
            if (codBarraSapList.isEmpty()) {
                codigosNoEncontrados.add(codBarra); // o codBarra
                return false;
            }

            // ✅ Usar el valor oficial encontrado
            String codBarraSap = codBarraSapList.get(0);
            venta.setCodBarra(codBarraSap.trim());

            // 🔍 SEGUNDO QUERY: Obtener todos los datos asociados (producto + cliente fijo ID 5970)
            queryStr = "SELECT c.id AS ClienteID, c.cod_Cliente, c.nombre_Cliente, c.ciudad, c.codigo_Proveedor, " +
                    "p.id AS IdProducto, p.cod_Item, p.cod_Barra_Sap, sapProd.CodProd, sapProd.CodBarra, " +
                    "sapProd.Descripcion AS DescripcionProducto, sapProd.Marca " +
                    "FROM SELLOUT.dbo.producto p " +
                    "LEFT JOIN SAPHANA..CG3_360CORP.SAP_Prod sapProd ON p.cod_Barra_Sap = sapProd.CodBarra " +
                    "JOIN SELLOUT.dbo.cliente c ON c.id = 5970 " +
                    "WHERE sapProd.CodBarra = :codBarraSap";

            query = entityManager.createNativeQuery(queryStr);
            query.setParameter("codBarraSap", codBarraSap);
            List<Object[]> results = query.getResultList();

            if (results.isEmpty()) {
                guardarCodigoNoEncontrado(codBarra);
                return false;
            }

            Object[] result = results.get(0);

            if (result.length == 12) {
                // 🧩 Cargar datos del cliente
                Cliente cliente = new Cliente();
                cliente.setId(((Number) result[0]).longValue());
                cliente.setCodCliente((String) result[1]);
                cliente.setNombreCliente((String) result[2]);
                venta.getCliente().setCiudad((String) result[3]);
                cliente.setCodigoProveedor((String) result[4]);
                venta.setCliente(cliente);

                // 🧩 Cargar datos del producto
                Producto producto = new Producto();
                producto.setId(((Number) result[5]).longValue());
                producto.setCodItem((String) result[6]);
                producto.setCodBarraSap((String) result[7]);
                venta.setProducto(producto);

                // 📄 Asignar valores directos
                venta.setCodigoSap((String) result[8]);       // CodProd
                venta.setCodBarra((String) result[9]);         // CodBarra SAP
                venta.setDescripcion((String) result[10]);     // Descripción
                venta.setNombreProducto((String) result[10]); // Mismo que descripción
                venta.setMarca((String) result[11]);           // Marca

                return true;
            }

        } catch (Exception e) {
            e.printStackTrace();
            guardarCodigoNoEncontrado(codBarra);
        }

        return false;
    }    

    private static final String CARPETA_CODIGOS = "/creacion-codigos";

    private void guardarCodigoNoEncontrado(String codItem) {
        String downloadPath = Paths.get(CARPETA_CODIGOS, "codigos_no_encontrados.txt").toString();
        System.out.println("Intentando guardar archivo en: " + downloadPath);
        try (BufferedWriter writer = Files.newBufferedWriter(Paths.get(downloadPath),
                StandardOpenOption.CREATE, StandardOpenOption.APPEND)) {
    
            writer.write(codItem);
            writer.newLine();
            System.out.println("Código guardado en archivo en: " + downloadPath);
        } catch (IOException e) {
            System.err.println("Error al guardar código no encontrado: " + e.getMessage());
        }
    }
    
    public File guardarCodigosNoEncontradosEnArchivo(List<String> codigosNoEncontrados) {
        if (codigosNoEncontrados.isEmpty()) {
            return null;
        }
    
        try {
            Path directorio = Paths.get(CARPETA_CODIGOS);
            if (!Files.exists(directorio)) {
                Files.createDirectories(directorio);
            }
    
            String nombreArchivo = "codigos_no_encontrados_" + java.time.LocalDateTime.now()
                    .toString().replace(":", "-") + ".txt";
            Path archivo = directorio.resolve(nombreArchivo);
    
            try (BufferedWriter writer = Files.newBufferedWriter(archivo, StandardOpenOption.CREATE, StandardOpenOption.APPEND)) {
                writer.write("Códigos de barra no encontrados - " + java.time.LocalDateTime.now());
                writer.newLine();
                for (String codigo : codigosNoEncontrados) {
                    writer.write(codigo);
                    writer.newLine();
                }
                writer.write("--------------------------------------------------");
                writer.newLine();
            }
    
            return archivo.toFile();
        } catch (IOException e) {
            e.printStackTrace();
            return null;
        }
    }
    

    public ResponseEntity<Resource> obtenerArchivoCodigosNoEncontrados(List<String> codigosNoEncontrados) {
        File archivo = guardarCodigosNoEncontradosEnArchivo(codigosNoEncontrados);
        if (archivo == null) {
            return ResponseEntity.status(HttpStatus.NO_CONTENT).body(null);
        }

        Resource fileResource = new FileSystemResource(archivo);
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + archivo.getName())
            .contentType(MediaType.TEXT_PLAIN)
            .contentLength(archivo.length())
            .body(fileResource);
    }
    
    @Transactional
    public void guardarVentas(List<Venta> ventas) {
        int batchSize = 200; // ajusta a tu gusto
        for (int i = 0; i < ventas.size(); i++) {
            guardarOActualizarVenta(ventas.get(i));
            // flush periódico para evitar transacciones gigantes
            if ((i + 1) % batchSize == 0) {
                ventaRepository.flush();
            }
        }
        ventaRepository.flush();
    }


    @Transactional
    public void guardarVentasConExecutorService(List<Venta> ventas) {
        int batchSize = 50;
        ExecutorService executorService = Executors.newFixedThreadPool(10);
        try {
            for (int i = 0; i < ventas.size(); i += batchSize) {
                int end = Math.min(i + batchSize, ventas.size());
                List<Venta> batchList = ventas.subList(i, end);
                executorService.submit(() -> {
                    try {
                        ventaRepository.saveAll(batchList);
                        ventaRepository.flush();
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                });
            }
        } finally {
            executorService.shutdown();
            try {
                if (!executorService.awaitTermination(60, TimeUnit.SECONDS)) {
                    executorService.shutdownNow();
                }
            } catch (InterruptedException e) {
                executorService.shutdownNow();
            }
        }
    }

    public List<Venta> obtenerTodasLasVentas() {
        return ventaRepository.findAll();
    }

    public Optional<Venta> obtenerVentaPorId(Long id) {
        return ventaRepository.findById(id);
    }

    // Actualizar una venta
    public Venta actualizarVenta(Long id, Venta nuevaVenta) {
        return ventaRepository.findById(id).map(venta -> {
            venta.setAnio(nuevaVenta.getAnio());
            venta.setMes(nuevaVenta.getMes());
            venta.setDia(nuevaVenta.getDia()); // Nuevo campo
            venta.setMarca(nuevaVenta.getMarca());
            venta.setVentaDolares(nuevaVenta.getVentaDolares());
            venta.setVentaUnidad(nuevaVenta.getVentaUnidad());
            venta.setNombreProducto(nuevaVenta.getNombreProducto());
            venta.setCodigoSap(nuevaVenta.getCodigoSap());
            venta.setCodBarra(nuevaVenta.getCodBarra());
            venta.setCodPdv(nuevaVenta.getCodPdv());
            venta.setDescripcion(nuevaVenta.getDescripcion());
            venta.setPdv(nuevaVenta.getPdv());
            venta.setStockDolares(nuevaVenta.getStockDolares());
            venta.setStockUnidades(nuevaVenta.getStockUnidades());
            venta.setCliente(nuevaVenta.getCliente());
            venta.setProducto(nuevaVenta.getProducto());
            return ventaRepository.save(venta);
        }).orElseThrow(() -> new RuntimeException("Venta no encontrada con el ID: " + id));
    }

    // Eliminar una venta
    public boolean eliminarVenta(Long id) {
        return ventaRepository.findById(id).map(venta -> {
            ventaRepository.delete(venta);
            return true;
        }).orElse(false);
    }

    // Eliminar varias ventas por sus IDs
    public boolean eliminarVentas(List<Long> ids) {
        try {
            List<Venta> ventas = ventaRepository.findAllById(ids);
            ventaRepository.deleteAll(ventas);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    // Obtener todas las marcas disponibles en las ventas
    public List<String> obtenerMarcasDisponibles() {
        String queryStr = "SELECT DISTINCT v.marca FROM Venta v WHERE v.marca IS NOT NULL";
        Query query = entityManager.createQuery(queryStr);
        return query.getResultList();
    }

    @Transactional
    public List<Object[]> obtenerReporteVentas() {
        try {
            String sql = """
                WITH VentasMensuales AS (
                    SELECT 
                        v.cod_Pdv,
                        v.pdv,
                        FORMAT(v.anio, '0000') + '-' + FORMAT(v.mes, '00') AS periodo,
                        SUM(CAST(v.venta_Unidad AS INT)) AS total_unidades
                    FROM [SELLOUT].[dbo].[venta] v
                    GROUP BY v.cod_Pdv, v.pdv, v.anio, v.mes
                ),
                PromedioUnidades AS (
                    SELECT 
                        cod_Pdv,
                        AVG(total_unidades) AS promedio_mensual
                    FROM VentasMensuales
                    WHERE periodo IN (
                        SELECT DISTINCT TOP 3 periodo 
                        FROM VentasMensuales 
                        ORDER BY periodo DESC
                    )
                    GROUP BY cod_Pdv
                )
                SELECT 
                    vm.cod_Pdv,
                    vm.pdv,
                    tm.ciudad,
                    tm.tipo_Display_Essence,
                    tm.tipo_Mueble_Display_Catrice,
                    COALESCE(SUM(vm.total_unidades), 0) AS total_unidades_mes,
                    COALESCE(pu.promedio_mensual, 0) AS promedio_mes,
                    ROUND(COALESCE(pu.promedio_mensual, 0) / 30, 2) AS unidad_diaria
                FROM VentasMensuales vm
                INNER JOIN [SELLOUT].[dbo].[tipo_mueble] tm 
                    ON vm.cod_Pdv = tm.cod_Pdv
                LEFT JOIN PromedioUnidades pu 
                    ON vm.cod_Pdv = pu.cod_Pdv
                GROUP BY 
                    vm.cod_Pdv, vm.pdv, 
                    tm.ciudad, 
                    tm.tipo_Display_Essence, 
                    tm.tipo_Mueble_Display_Catrice, 
                    pu.promedio_mensual;
            """;

            Query query = entityManager.createNativeQuery(sql);
            List<Object[]> resultados = query.getResultList();
            
            // Imprimir información de depuración
            System.out.println("📊 Reporte generado con " + resultados.size() + " registros");
            
            return resultados;
        } catch (Exception e) {
            System.err.println("❌ Error al generar reporte de ventas: " + e.getMessage());
            e.printStackTrace();
            // Retornar lista vacía en lugar de null para evitar NullPointerException
            return new ArrayList<>();
        }
    }
    // ... existing code ...

    /**
     * Obtiene todos los años disponibles en las ventas.
     * @param clienteId ID del cliente para filtrar (opcional)
     * @return Lista de años disponibles
     */
    public List<Integer> obtenerAniosDisponibles(Long clienteId) {
        try {
            String queryStr;
            Query query;
            
            if (clienteId != null) {
                queryStr = "SELECT DISTINCT v.anio FROM Venta v WHERE v.cliente.id = :clienteId ORDER BY v.anio DESC";
                query = entityManager.createQuery(queryStr);
                query.setParameter("clienteId", clienteId);
            } else {
                queryStr = "SELECT DISTINCT v.anio FROM Venta v ORDER BY v.anio DESC";
                query = entityManager.createQuery(queryStr);
            }
            
            return query.getResultList();
        } catch (Exception e) {
            System.err.println("Error al obtener años disponibles: " + e.getMessage());
            e.printStackTrace();
            return new ArrayList<>();
        }
    }
    
    /**
     * Obtiene todos los meses disponibles en las ventas para un año específico.
     * @param anio Año para filtrar
     * @param clienteId ID del cliente para filtrar (opcional)
     * @return Lista de meses disponibles
     */
    public List<Integer> obtenerMesesDisponibles(Integer anio, Long clienteId) {
        try {
            String queryStr;
            Query query;
            
            if (anio != null && clienteId != null) {
                queryStr = "SELECT DISTINCT v.mes FROM Venta v WHERE v.anio = :anio AND v.cliente.id = :clienteId ORDER BY v.mes";
                query = entityManager.createQuery(queryStr);
                query.setParameter("anio", anio);
                query.setParameter("clienteId", clienteId);
            } else if (anio != null) {
                queryStr = "SELECT DISTINCT v.mes FROM Venta v WHERE v.anio = :anio ORDER BY v.mes";
                query = entityManager.createQuery(queryStr);
                query.setParameter("anio", anio);
            } else if (clienteId != null) {
                queryStr = "SELECT DISTINCT v.mes FROM Venta v WHERE v.cliente.id = :clienteId ORDER BY v.mes";
                query = entityManager.createQuery(queryStr);
                query.setParameter("clienteId", clienteId);
            } else {
                queryStr = "SELECT DISTINCT v.mes FROM Venta v ORDER BY v.mes";
                query = entityManager.createQuery(queryStr);
            }
            
            return query.getResultList();
        } catch (Exception e) {
            System.err.println("Error al obtener meses disponibles: " + e.getMessage());
            e.printStackTrace();
            return new ArrayList<>();
        }
    }   

    private String obtenerValorCeldaComoString(Row fila, Integer columnaIndex) {
        if (columnaIndex == null) return null;
        Cell celda = fila.getCell(columnaIndex);
        if (celda == null) return null;

        switch (celda.getCellType()) {
            case STRING:
                return celda.getStringCellValue().trim();
            case NUMERIC:
                return String.valueOf((long) celda.getNumericCellValue()); // o usar DecimalFormat si quieres mantener ceros a la izquierda
            case BOOLEAN:
                return String.valueOf(celda.getBooleanCellValue());
            case FORMULA:
                return celda.getCellFormula();
            default:
                return "";
        }
    }

    private Double obtenerValorCeldaComoDouble(Row fila, Integer columnaIndex) {
        if (columnaIndex == null) return null;
        Cell celda = fila.getCell(columnaIndex);
        if (celda == null) return null;

        if (celda.getCellType() == CellType.NUMERIC) {
            return celda.getNumericCellValue();
        } else if (celda.getCellType() == CellType.STRING) {
            try {
                return Double.parseDouble(celda.getStringCellValue().trim());
            } catch (NumberFormatException e) {
                return null;
            }
        }

        return null;
    }

    private Date obtenerFechaCelda(Row fila, Integer columnaIndex) {
        if (columnaIndex == null) return null;
        Cell celda = fila.getCell(columnaIndex);
        if (celda == null) return null;

        if (celda.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(celda)) {
            return celda.getDateCellValue();
        }

        return null;
    }

    public boolean cargarVentasDesdeExcel(InputStream inputStream, Map<String, Integer> mapeoColumnas, int filaInicio) {
        try (Workbook workbook = WorkbookFactory.create(inputStream)) {
            Sheet hoja = workbook.getSheetAt(0);

            for (int filaIndex = filaInicio; filaIndex <= hoja.getLastRowNum(); filaIndex++) {
                Row fila = hoja.getRow(filaIndex);
                if (fila == null) continue;

                // Extraer valores desde las columnas del Excel
                String codBarra = obtenerValorCeldaComoString(fila, mapeoColumnas.get("columnaCodBarra"));
                String marca = obtenerValorCeldaComoString(fila, mapeoColumnas.get("columnaMarca"));
                String nombreProducto = obtenerValorCeldaComoString(fila, mapeoColumnas.get("columnaProducto"));
                String descripcion = obtenerValorCeldaComoString(fila, mapeoColumnas.get("columnaDescripcion"));
                String codPdv = obtenerValorCeldaComoString(fila, mapeoColumnas.get("columnaCodPdv"));
                String pdv = obtenerValorCeldaComoString(fila, mapeoColumnas.get("columnaPdv"));

                Double ventaUnidades = obtenerValorCeldaComoDouble(fila, mapeoColumnas.get("columnaUnidades"));
                Double ventaUSD = obtenerValorCeldaComoDouble(fila, mapeoColumnas.get("columnaDolares"));
                Date fecha = obtenerFechaCelda(fila, mapeoColumnas.get("columnaFecha"));

                if ((ventaUnidades != null && ventaUnidades > 0) || (ventaUSD != null && ventaUSD > 0)) {
                    Venta venta = new Venta();
                    venta.setAnio(fecha.toInstant().atZone(ZoneId.systemDefault()).getYear());
                    venta.setMes(fecha.toInstant().atZone(ZoneId.systemDefault()).getMonthValue());
                    venta.setDia(fecha.toInstant().atZone(ZoneId.systemDefault()).getDayOfMonth());
                    venta.setMarca(marca);
                    venta.setNombreProducto(nombreProducto);
                    venta.setCodBarra(codBarra);
                    venta.setDescripcion(descripcion);
                    venta.setCodPdv(codPdv);
                    venta.setPdv(pdv);
                    venta.setVentaUnidad(ventaUnidades != null ? ventaUnidades : 0);
                    venta.setVentaDolares(ventaUSD != null ? ventaUSD : 0);
                    venta.setStockDolares(0);
                    venta.setStockUnidades(0);
                    venta.setUnidadesDiarias("0");

                    ventaRepository.save(venta);
                }
            }

            return true;

        } catch (Exception e) {
            e.printStackTrace();
            return false;
        }
    }

    @Transactional
    public void guardarOActualizarVenta(Venta nuevaVenta) {
        // Normaliza claves si aplica
        String codBarra = nuevaVenta.getCodBarra() == null ? null : nuevaVenta.getCodBarra().trim();
        String codPdv   = nuevaVenta.getCodPdv()   == null ? null : nuevaVenta.getCodPdv().trim();
        nuevaVenta.setCodBarra(codBarra);
        nuevaVenta.setCodPdv(codPdv);

        Long clienteId = (nuevaVenta.getCliente() != null) ? nuevaVenta.getCliente().getId() : null;

        Optional<Venta> existente = ventaRepository
            .findByClienteIdAndAnioAndMesAndDiaAndCodBarraAndCodPdv(
                clienteId,
                nuevaVenta.getAnio(),
                nuevaVenta.getMes(),
                nuevaVenta.getDia(),
                nuevaVenta.getCodBarra(),
                nuevaVenta.getCodPdv()
            );

        if (existente.isPresent()) {
            Venta v = existente.get();
            // Campos que deseas pisar en una re-carga
            v.setVentaDolares(nuevaVenta.getVentaDolares());
            v.setVentaUnidad(nuevaVenta.getVentaUnidad());
            v.setStockDolares(nuevaVenta.getStockDolares());
            v.setStockUnidades(nuevaVenta.getStockUnidades());
            v.setPdv(nuevaVenta.getPdv());
            v.setCiudad(nuevaVenta.getCiudad());
            v.setMarca(nuevaVenta.getMarca());
            v.setNombreProducto(nuevaVenta.getNombreProducto());
            v.setCodigoSap(nuevaVenta.getCodigoSap());
            v.setDescripcion(nuevaVenta.getDescripcion());
            v.setCliente(nuevaVenta.getCliente());
            v.setProducto(nuevaVenta.getProducto());
            // Si también cambian estos, puedes actualizar:
            // v.setMarca(...), v.setNombreProducto(...), etc.
            ventaRepository.save(v);
        } else {
            ventaRepository.save(nuevaVenta);
        }
    }
    

}