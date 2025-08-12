package com.manamer.backend.business.sellout.controller;

import com.google.common.net.HttpHeaders;
import com.manamer.backend.business.sellout.models.Cliente;
import com.manamer.backend.business.sellout.models.ExcelUtils;
import com.manamer.backend.business.sellout.models.Producto;
import com.manamer.backend.business.sellout.models.TipoMueble;
import com.manamer.backend.business.sellout.models.Venta;
import com.manamer.backend.business.sellout.repositories.ProductoRepository;
import com.manamer.backend.business.sellout.service.TipoMuebleService;
import com.manamer.backend.business.sellout.service.VentaService;
import com.manamer.backend.business.sellout.service.ClienteService;
import com.manamer.backend.business.sellout.service.ProductoService;
import org.springframework.http.ResponseEntity;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.apache.commons.io.output.ByteArrayOutputStream;
import org.apache.poi.hssf.usermodel.HSSFWorkbook;
import org.apache.poi.ss.usermodel.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileWriter;
import java.io.IOException;
import java.text.Normalizer;
import java.util.List;
import java.util.Map;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;

import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
@RestController
@CrossOrigin(origins = "*", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE})
@RequestMapping("/api/fybeca")
public class FybecaController {

    // Constante para el ID del cliente Fybeca
    private static final Long CLIENTE_FYBECA_ID = 5969L;
    
    private final VentaService ventaService;
    @Autowired
    private ClienteService  serviceClienteService;

    @Autowired
    private ProductoService serviceProductoService;

    @Autowired
    private ProductoRepository repository;

    @Autowired
    private ClienteService servicio;

    private static final Logger logger = LoggerFactory.getLogger(FybecaController.class);

    @Autowired
    private ClienteService ClienteService;  // Inyección del servicio

    @Autowired
    private ProductoService ProductoService;  // Inyección del servicio

    private final TipoMuebleService tipoMuebleService;

    @Autowired
    public FybecaController(ClienteService ClienteService,
                            ProductoService ProductoService,
                            VentaService ventaService,
                            TipoMuebleService tipoMuebleService) {
        this.ClienteService = ClienteService;
        this.ProductoService = ProductoService;
        this.ventaService = ventaService;
        this.tipoMuebleService = tipoMuebleService;
    }

    // Métodos para ventas
    @GetMapping("/venta") // Obtener todas las ventas
    public ResponseEntity<List<Venta>> obtenerTodasLasVentas() {
        List<Venta> ventas = ventaService.obtenerTodasLasVentas();
        ventas.removeIf(venta -> venta.getCliente() == null || venta.getCliente().getId() != 5969L);
        return ResponseEntity.ok(ventas);
    }

    @GetMapping("/venta/{id}")
    public ResponseEntity<Venta> obtenerVentaPorId(@PathVariable Long id) {
        Optional<Venta> venta = ventaService.obtenerVentaPorId(id);
        
        // Verificar si la venta existe y pertenece al cliente específico
        if (venta.isPresent() && (venta.get().getCliente() == null || venta.get().getCliente().getId() != CLIENTE_FYBECA_ID)) {
            return ResponseEntity.notFound().build();
        }
        
        return venta.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PutMapping("/venta/{id}")
    public ResponseEntity<Venta> actualizarVenta(@PathVariable Long id, @RequestBody Venta nuevaVenta) {
        try {
            Venta ventaActualizada = ventaService.actualizarVenta(id, nuevaVenta);
            return ResponseEntity.ok(ventaActualizada);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }


    @DeleteMapping("/venta/{id}")
    public ResponseEntity<Void> eliminarVenta(@PathVariable Long id) {
        try {
            ventaService.eliminarVenta(id);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }

    @DeleteMapping("/ventas-forma-masiva")
    public ResponseEntity<Void> eliminarVentas(@RequestBody List<Long> ids) {
        if (ventaService.eliminarVentas(ids)) {
            return ResponseEntity.ok().build();
        } else {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping("/subir-archivo-venta")
    public ResponseEntity<Resource> subirArchivoVentaFlexible(@RequestParam("file") MultipartFile file) {
        logger.info("Inicio de carga de archivo de ventas: {}", file.getOriginalFilename());

        Set<String> codigosNoEncontrados = new HashSet<>();
        List<Venta> ventas = new ArrayList<>();

        if (file.isEmpty()) {
            logger.warn("El archivo recibido está vacío.");
            return ResponseEntity.badRequest().build();
        }

        try (Workbook workbook = obtenerWorkbookCorrecto(file)) {
            Sheet sheet = workbook.getSheetAt(0);
            Row encabezado = sheet.getRow(0);

            if (encabezado == null) {
                throw new IllegalArgumentException("❌ La primera fila (encabezados) está vacía.");
            }

            Map<String, List<String>> camposEsperados = new HashMap<>();
            camposEsperados.put("anio", List.of("año", "anio", "Año"));
            camposEsperados.put("mes", List.of("mes", "Mes"));
            camposEsperados.put("codBarra", List.of("codigo barra", "cod_barra", "codigobarra", "COD ITEM"));
            camposEsperados.put("codPdv", List.of("codigo pdv", "cod_pdv", "COD LOCAL"));
            camposEsperados.put("pdv", List.of("pdv", "NOMBRE LOCAL"));
            camposEsperados.put("ventaDolares", List.of("venta_dolares", "venta $", "venta dolares", "Venta Dolares"));
            camposEsperados.put("ventaUnidad", List.of("venta_unidades", "venta unidades", "Venta Unidades"));
            camposEsperados.put("stockDolares", List.of("stock_dolares", "stock usd", "Stock Dolares", "stock dolares"));
            camposEsperados.put("stockUnidades", List.of("stock_unidades", "stock unidades", "Stock en Unidades"));

            Map<String, Integer> columnaPorCampo = new HashMap<>();
            for (Cell celda : encabezado) {
                String valor = obtenerValorCelda(celda, String.class);
                if (valor == null) continue;
                String valorNormalizado = normalizarTexto(valor);

                for (Map.Entry<String, List<String>> entry : camposEsperados.entrySet()) {
                    if (entry.getValue().stream().map(FybecaController::normalizarTexto).anyMatch(v -> v.equals(valorNormalizado))) {
                        columnaPorCampo.put(entry.getKey(), celda.getColumnIndex());
                        logger.info("✔ Columna '{}' mapeada a campo '{}'", valor, entry.getKey());
                    }
                }
            }

            for (String campo : camposEsperados.keySet()) {
                if (!columnaPorCampo.containsKey(campo)) {
                    logger.warn("❌ No se detectó ninguna columna para el campo obligatorio: {}", campo);
                }
            }

            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;
                logger.debug("📄 Procesando fila {}", i + 1);

                try {
                    Venta venta = new Venta();
                    venta.setDia(1); // valor fijo

                    if (columnaPorCampo.containsKey("anio"))
                        venta.setAnio(obtenerValorCelda(row.getCell(columnaPorCampo.get("anio")), Integer.class));

                    if (columnaPorCampo.containsKey("mes"))
                        venta.setMes(obtenerValorCelda(row.getCell(columnaPorCampo.get("mes")), Integer.class));

                    if (columnaPorCampo.containsKey("ventaDolares"))
                        venta.setVentaDolares(obtenerValorCelda(row.getCell(columnaPorCampo.get("ventaDolares")), Double.class));

                    if (columnaPorCampo.containsKey("ventaUnidad"))
                        venta.setVentaUnidad(obtenerValorCelda(row.getCell(columnaPorCampo.get("ventaUnidad")), Double.class));

                    if (columnaPorCampo.containsKey("codBarra"))
                        venta.setCodBarra(obtenerValorCelda(row.getCell(columnaPorCampo.get("codBarra")), String.class));

                    if (columnaPorCampo.containsKey("codPdv"))
                        venta.setCodPdv(obtenerValorCelda(row.getCell(columnaPorCampo.get("codPdv")), String.class));

                    if (columnaPorCampo.containsKey("pdv"))
                        venta.setPdv(obtenerValorCelda(row.getCell(columnaPorCampo.get("pdv")), String.class));

                    if (columnaPorCampo.containsKey("stockDolares"))
                        venta.setStockDolares(obtenerValorCelda(row.getCell(columnaPorCampo.get("stockDolares")), Double.class));

                    if (columnaPorCampo.containsKey("stockUnidades"))
                        venta.setStockUnidades(obtenerValorCelda(row.getCell(columnaPorCampo.get("stockUnidades")), Double.class));

                    if (venta.getCodBarra() == null || venta.getCodBarra().trim().isEmpty()) {
                        logger.warn("⚠️ Fila {}: Código de barra vacío", i + 1);
                        codigosNoEncontrados.add("Código vacío en fila " + (i + 1));
                        continue;
                    }

                    boolean datosCargados = ventaService.cargarDatosDeProducto(venta, codigosNoEncontrados);
                    if (!datosCargados) {
                        logger.warn("⚠️ Fila {}: No se encontraron datos para el código {}", i + 1, venta.getCodBarra());
                        codigosNoEncontrados.add(venta.getCodBarra());
                        continue;
                    }

                    ventaService.guardarOActualizarVenta(venta);
                    logger.debug("✔ Fila {} procesada correctamente", i + 1);

                } catch (Exception exFila) {
                    logger.error("❌ Error procesando fila {}: {}", i + 1, exFila.getMessage(), exFila);
                    codigosNoEncontrados.add("Error en fila " + (i + 1) + ": " + exFila.getMessage());
                }
            }

            // Retornar archivo .txt con los códigos no encontrados
            return ventaService.obtenerArchivoCodigosNoEncontrados(new ArrayList<>(codigosNoEncontrados));

        } catch (IOException e) {
            logger.error("❌ Error leyendo archivo Excel: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        } catch (Exception e) {
            logger.error("❌ Error inesperado al procesar archivo: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }

    public static String normalizarTexto(String input) {
        if (input == null) return null;
        return Normalizer.normalize(input.toLowerCase().trim(), Normalizer.Form.NFD)
                        .replaceAll("\\p{InCombiningDiacriticalMarks}+", "")
                        .replaceAll("[^\\p{ASCII}]", "") // quita cualquier otro símbolo especial
                        .replaceAll("[\\.,\"']", ""); // quita comas, puntos, comillas y apóstrofes
    }

    private Workbook obtenerWorkbookCorrecto(MultipartFile file) throws IOException {
        String nombreArchivo = file.getOriginalFilename();
        if (nombreArchivo != null && nombreArchivo.toLowerCase().endsWith(".xls")) {
            return new HSSFWorkbook(file.getInputStream());
        } else {
            return new XSSFWorkbook(file.getInputStream());
        }
    }

    private <T> T obtenerValorCelda(Cell cell, Class<T> clazz) {
        if (cell == null) {
            // Devolver 0 para tipos numéricos, null para otros tipos
            if (clazz == Integer.class) {
                return clazz.cast(0);
            } else if (clazz == Double.class) {
                return clazz.cast(0.0);
            } else {
                return null;
            }
        }

        try {
            switch (cell.getCellType()) {
                case NUMERIC:
                    if (clazz == Integer.class) {
                        return clazz.cast((int) cell.getNumericCellValue());
                    } else if (clazz == Double.class) {
                        return clazz.cast(cell.getNumericCellValue());
                    } else if (clazz == String.class) {
                        return clazz.cast(String.valueOf((int) cell.getNumericCellValue()));
                    }
                    break;
                case STRING:
                    String value = cell.getStringCellValue().trim();
                    if (clazz == Integer.class) {
                        try {
                            return clazz.cast(Integer.parseInt(value));
                        } catch (NumberFormatException e) {
                            return clazz.cast(0);
                        }
                    } else if (clazz == Double.class) {
                        try {
                            return clazz.cast(Double.parseDouble(value));
                        } catch (NumberFormatException e) {
                            return clazz.cast(0.0);
                        }
                    } else {
                        return clazz.cast(value);
                    }
                case BLANK:
                    // Devolver 0 para tipos numéricos, null para otros tipos
                    if (clazz == Integer.class) {
                        return clazz.cast(0);
                    } else if (clazz == Double.class) {
                        return clazz.cast(0.0);
                    } else {
                        return null;
                    }
                default:
                    // Devolver 0 para tipos numéricos, null para otros tipos
                    if (clazz == Integer.class) {
                        return clazz.cast(0);
                    } else if (clazz == Double.class) {
                        return clazz.cast(0.0);
                    } else {
                        return null;
                    }
            }
        } catch (Exception e) {
            System.err.println("Error al convertir celda: " + cell.toString());
            e.printStackTrace();
            
            // En caso de error, devolver 0 para tipos numéricos
            if (clazz == Integer.class) {
                return clazz.cast(0);
            } else if (clazz == Double.class) {
                return clazz.cast(0.0);
            }
        }
        return null;
    }
    
    @GetMapping("/reporte-ranquin-ventas")
    public ResponseEntity<?> obtenerReporteVentas() {
    try {
        List<Object[]> resultado = ventaService.obtenerReporteVentas();
        
        // Filtrar resultados para incluir solo el cliente específico
        // Esto depende de la estructura de tus datos en el reporte
        // Asumiendo que el ID del cliente está en alguna posición del array
        if (resultado != null && !resultado.isEmpty()) {
            List<Object[]> resultadoFiltrado = new ArrayList<>();
            for (Object[] row : resultado) {
                // Ajusta el índice según donde esté el ID del cliente en tu array
                // Por ejemplo, si el ID del cliente está en la posición 3:
                if (row.length > 3 && row[3] != null && row[3].equals(CLIENTE_FYBECA_ID)) {
                    resultadoFiltrado.add(row);
                }
            }
            resultado = resultadoFiltrado;
        }
        
        if (resultado == null || resultado.isEmpty()) {
            return ResponseEntity.noContent().build();
        }
        
        return ResponseEntity.ok(resultado);
    } catch (Exception e) {
        logger.error("Error al generar reporte: {}", e.getMessage(), e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body("Error al generar el reporte: " + e.getMessage());
    }
}

    // Endpoint para obtener todas las marcas disponibles
    @GetMapping("/marcas-ventas")
    public List<String> obtenerMarcasDisponibles() {
        return ventaService.obtenerMarcasDisponibles();
    }
    
    @GetMapping("/anios-disponibles")
    public ResponseEntity<List<Integer>> obtenerAniosDisponibles(
            @RequestParam(required = false) Long clienteId) {
        List<Integer> anios = ventaService.obtenerAniosDisponibles(clienteId);
        return ResponseEntity.ok(anios);
    }

    @GetMapping("/meses-disponibles")
    public ResponseEntity<List<Integer>> obtenerMesesDisponibles(
            @RequestParam(required = false) Integer anio,
            @RequestParam(required = false) Long clienteId) {
        List<Integer> meses = ventaService.obtenerMesesDisponibles(anio, clienteId);
        return ResponseEntity.ok(meses);
    }
    
    // Métodos Para la Tabla de CLientes
    @GetMapping("/cliente")
    public List<Cliente> tablaClientes() {
        return serviceClienteService.getAllClientes();
    }

    @GetMapping("/cliente/{id}")
    public ResponseEntity<Cliente> obtenerCliente(@PathVariable Long id) {
        return serviceClienteService.getClienteById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/cliente")
    public Cliente crearCliente(@RequestBody Cliente cliente) {
        return serviceClienteService.saveOrUpdate(cliente);
    }

    @PutMapping("/cliente/{id}")
    public ResponseEntity<Cliente> actualizarCliente(@PathVariable Long id, @RequestBody Cliente cliente) {
        if (!serviceClienteService.getClienteById(id).isPresent()) {
            return ResponseEntity.notFound().build();
        }
        cliente.setId(id);
        return ResponseEntity.ok(serviceClienteService.saveOrUpdate(cliente));
    }

    @DeleteMapping("/cliente/{id}")
    public ResponseEntity<Void> eliminarCliente(@PathVariable Long id) {
        if (!serviceClienteService.getClienteById(id).isPresent()) {
            return ResponseEntity.notFound().build();
        }
        serviceClienteService.deleteCliente(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/cliente/upload")
    public String uploadClientes(@RequestParam("file") MultipartFile file) {
        return servicio.uploadClientesFromExcel(file);
    }

    // Métodos para  de productos
    @GetMapping("/productos")
    public List<Producto> tablaProductos() {
        return serviceProductoService.getAllProductos();
    }

    @PostMapping("/producto")
    public Producto crearProducto(@RequestBody Producto producto) {
        return serviceProductoService.saveOrUpdate(producto);
    }

    @PostMapping("/template-productos")
    public ResponseEntity<String> cargarProductosDesdeArchivo(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return new ResponseEntity<>("Por favor, seleccione un archivo", HttpStatus.BAD_REQUEST);
        }

        try (Workbook workbook = new XSSFWorkbook(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            List<Producto> productos = new ArrayList<>();

            for (Row row : sheet) {
                if (row.getRowNum() < 1) {
                    continue; // Saltar la fila de encabezado
                }

                Producto producto = new Producto();

                if (row.getCell(0) != null) {
                    Cell cell = row.getCell(0);
                    if (cell.getCellType() == CellType.NUMERIC) {
                        producto.setCodItem(String.valueOf((long) cell.getNumericCellValue()));
                    } else {
                        producto.setCodItem(cell.getStringCellValue());
                    }
                }

                if (row.getCell(1) != null) {
                    Cell cell = row.getCell(1);
                    if (cell.getCellType() == CellType.NUMERIC) {
                        producto.setCodBarraSap(String.valueOf((long) cell.getNumericCellValue()));
                    } else {
                        producto.setCodBarraSap(cell.getStringCellValue());
                    }
                }

                productos.add(producto);
            }

            ProductoService.guardarProductos(productos);
            return ResponseEntity.ok("Archivo cargado y procesado correctamente.");
        } catch (IOException e) {
            e.printStackTrace();
            return new ResponseEntity<>("Error al procesar el archivo", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // Métodos para eliminación de productos
    public void deleteProductos(List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            throw new IllegalArgumentException("No se proporcionaron IDs para eliminar.");
        }

        int batchSize = 2000;
        List<List<Long>> batches = new ArrayList<>();

        for (int i = 0; i < ids.size(); i += batchSize) {
            int end = Math.min(i + batchSize, ids.size());
            batches.add(ids.subList(i, end));
        }

        for (List<Long> batch : batches) {
            repository.deleteAllById(batch);
        }
    }

    @DeleteMapping("/productos")
    public ResponseEntity<String> eliminarProductos(@RequestBody List<Long> ids) {
        try {
            ProductoService.deleteProductos(ids);
            return ResponseEntity.ok("Productos eliminados correctamente.");
        } catch (IllegalArgumentException e) {
            return new ResponseEntity<>(e.getMessage(), HttpStatus.BAD_REQUEST);
        }
    }


    //CRUD de tabla Tipo Mueble

    @PostMapping("/tipo-mueble")
    public ResponseEntity<TipoMueble> crearTipoMueble(@RequestBody TipoMueble tipoMueble) {
        TipoMueble nuevoTipoMueble = tipoMuebleService.guardarTipoMueble(tipoMueble);
        return ResponseEntity.ok(nuevoTipoMueble);
    }

    @GetMapping("/tipo-mueble")
    public ResponseEntity<List<TipoMueble>> obtenerTodosLosTiposMueble() {
        List<TipoMueble> tiposMueble = tipoMuebleService.obtenerTodosLosTiposMueble();
        return ResponseEntity.ok(tiposMueble);
    }

    @GetMapping("/tipo-mueble/{id}")
    public ResponseEntity<TipoMueble> obtenerTipoMueblePorId(@PathVariable Long id) {
        Optional<TipoMueble> tipoMueble = tipoMuebleService.obtenerTipoMueblePorId(id);
        return tipoMueble.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PutMapping("/tipo-mueble/{id}")
    public ResponseEntity<TipoMueble> actualizarTipoMueble(@PathVariable Long id, @RequestBody TipoMueble nuevoTipoMueble) {
        try {
            TipoMueble tipoMuebleActualizado = tipoMuebleService.actualizarTipoMueble(id, nuevoTipoMueble);
            return ResponseEntity.ok(tipoMuebleActualizado);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/tipo-mueble/{id}")
    public ResponseEntity<Void> eliminarTipoMueble(@PathVariable Long id) {
        if (tipoMuebleService.eliminarTipoMueble(id)) {
            return ResponseEntity.ok().build();
        } else {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/template-tipo-muebles")
    public ResponseEntity<List<TipoMueble>> subirTipoMuebles(@RequestParam("file") MultipartFile file) {
        List<TipoMueble> tipoMuebles = tipoMuebleService.cargarTipoMueblesDesdeArchivo(file);
        return ResponseEntity.ok(tipoMuebles);
    }

     // Método para eliminar múltiples TipoMueble por ID
    @DeleteMapping("/eliminar-varios-tipo-mueble")
    public ResponseEntity<String> eliminarTiposMueble(@RequestBody List<Long> ids) {
        boolean todosEliminados = tipoMuebleService.eliminarTiposMueble(ids);
        if (todosEliminados) {
            return ResponseEntity.ok("Tipos de muebles eliminados correctamente.");
        } else {
            return ResponseEntity.status(404).body("Algunos tipos de muebles no se encontraron.");
        }
    }

    public static byte[] convertWorkbookToByteArray(XSSFWorkbook workbook) throws IOException {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            workbook.write(out);
            return out.toByteArray();
        }
    }  

    // Método para descargar reporte de Ventas
    @GetMapping("/reporte-ventas")
    public ResponseEntity<byte[]> generarReporteVentas() {
        try {
            List<Venta> ventas = ventaService.obtenerTodasLasVentas();
            ventas.removeIf(venta -> venta.getCliente() == null || venta.getCliente().getId() != 5969L);
            // Crear libro de Excel
            XSSFWorkbook workbook = new XSSFWorkbook();
            Sheet sheet = workbook.createSheet("Ventas");

            // Crear encabezados
            Row header = sheet.createRow(0);
            header.createCell(0).setCellValue("Año");
            header.createCell(1).setCellValue("Mes");
            header.createCell(2).setCellValue("Marca");
            header.createCell(3).setCellValue("Código Cliente");
            header.createCell(4).setCellValue("Nombre Cliente");
            header.createCell(5).setCellValue("Código Barra SAP");
            header.createCell(6).setCellValue("Código Producto SAP");
            header.createCell(7).setCellValue("Código Item");
            header.createCell(8).setCellValue("Nombre Producto");
            header.createCell(9).setCellValue("Código PDV");
            header.createCell(10).setCellValue("Ciudad");
            header.createCell(11).setCellValue("PDV");
            header.createCell(12).setCellValue("Stock en Dólares");
            header.createCell(13).setCellValue("Stock en Unidades");
            header.createCell(14).setCellValue("Venta en Dólares");
            header.createCell(15).setCellValue("Venta en Unidades");

            // Llenar datos
            int rowNum = 1;
            for (Venta venta : ventas) {
                Row row = sheet.createRow(rowNum++);
                row.createCell(0).setCellValue(venta.getAnio());
                row.createCell(1).setCellValue(venta.getMes());
                row.createCell(2).setCellValue(venta.getMarca());

                // Cliente
                if (venta.getCliente() != null) {
                    row.createCell(3).setCellValue(venta.getCliente().getCodCliente());
                    row.createCell(4).setCellValue(venta.getCliente().getNombreCliente());
                    row.createCell(10).setCellValue(venta.getCliente().getCiudad());
                } else {
                    
                    row.createCell(3).setCellValue("N/A");
                    row.createCell(4).setCellValue("N/A");
                    row.createCell(10).setCellValue("N/A");
                }

                row.createCell(5).setCellValue(venta.getCodBarra());
                row.createCell(6).setCellValue(venta.getCodigoSap());

                // Producto
                if (venta.getProducto() != null) {
                    row.createCell(7).setCellValue(venta.getProducto().getCodItem());
                    row.createCell(8).setCellValue(venta.getNombreProducto());
                } else {
                    row.createCell(7).setCellValue("N/A");
                    row.createCell(8).setCellValue("N/A");
                }

                row.createCell(9).setCellValue(venta.getCodPdv());
                row.createCell(11).setCellValue(venta.getPdv());
                row.createCell(12).setCellValue(venta.getStockDolares());
                row.createCell(13).setCellValue(venta.getStockUnidades());
                row.createCell(14).setCellValue(venta.getVentaDolares());
                row.createCell(15).setCellValue(venta.getVentaUnidad());
            }

        
            // Convertir a bytes
            byte[] byteArray = ExcelUtils.convertWorkbookToByteArray(workbook);
            // Cerrar el archivo
            workbook.close();
            // Retornar el archivo Excel
            return ResponseEntity.ok()
                    .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                    .header("Content-Disposition", "attachment; filename=reporte_ventas.xlsx")
                    .body(byteArray);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }


    @GetMapping("/reporte-productos")
    public ResponseEntity<byte[]> generarReporteProductos() {
        try {
            List<Producto> productos = repository.findAll();

            // Crear libro de Excel
            XSSFWorkbook workbook = new XSSFWorkbook();
            Sheet sheet = workbook.createSheet(" Productos");

            // Crear encabezados
            Row header = sheet.createRow(0);
            header.createCell(0).setCellValue("Código Item");
            header.createCell(1).setCellValue("Código Barra SAP");

            // Llenar datos
            int rowNum = 1;
            for (Producto producto : productos) {
                Row row = sheet.createRow(rowNum++);
                row.createCell(0).setCellValue(producto.getCodItem());
                row.createCell(1).setCellValue(producto.getCodBarraSap());
            }

            // Convertir a bytes
            byte[] byteArray = ExcelUtils.convertWorkbookToByteArray(workbook);

            // Cerrar el archivo
            workbook.close();

            // Retornar el archivo Excel
            return ResponseEntity.ok()
                    .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                    .header("Content-Disposition", "attachment; filename=reporte__productos.xlsx")
                    .body(byteArray);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }


    @GetMapping("/reporte-tipo-mueble")
    public ResponseEntity<byte[]> generarReporteTipoMueble() {
        try {
            // Obtener todos los tipos de mueble
            List<TipoMueble> tiposMueble = tipoMuebleService.obtenerTodosLosTiposMueble();

            // Crear libro de Excel
            XSSFWorkbook workbook = new XSSFWorkbook();
            Sheet sheet = workbook.createSheet("Tipos de Mueble");

            // Crear encabezados
            Row header = sheet.createRow(0);
            header.createCell(0).setCellValue("Código Cliente");
            header.createCell(1).setCellValue("Nombre Cliente");
            header.createCell(2).setCellValue("Ciudad");
            header.createCell(3).setCellValue("Código PDV");
            header.createCell(4).setCellValue("Nombre PDV");
            header.createCell(5).setCellValue("Tipo Display Essence");
            header.createCell(6).setCellValue("Tipo Mueble Display Catrice");

            // Llenar datos
            int rowNum = 1;
            for (TipoMueble tipoMueble : tiposMueble) {
                Row row = sheet.createRow(rowNum++);
                
                // Asegurarse de que el Cliente no sea null
                if (tipoMueble.getCliente() != null) {
                    row.createCell(0).setCellValue(tipoMueble.getCliente().getCodCliente());
                    row.createCell(1).setCellValue(tipoMueble.getCliente().getNombreCliente());
                    row.createCell(2).setCellValue(tipoMueble.getCiudad());
                } else {
                    row.createCell(0).setCellValue("N/A");
                    row.createCell(1).setCellValue("N/A");
                    row.createCell(2).setCellValue("N/A");
                }
                
                // Otros campos de TipoMueble
                row.createCell(3).setCellValue(tipoMueble.getCodPdv());
                row.createCell(4).setCellValue(tipoMueble.getNombrePdv());
                row.createCell(5).setCellValue(tipoMueble.getTipoMuebleEssence());
                row.createCell(6).setCellValue(tipoMueble.getTipoMuebleCatrice());
            }

            // Convertir a bytes
            byte[] byteArray = ExcelUtils.convertWorkbookToByteArray(workbook);

            // Cerrar el archivo
            workbook.close();

            // Retornar el archivo Excel
            return ResponseEntity.ok()
                    .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                    .header("Content-Disposition", "attachment; filename=reporte_tipo_mueble.xlsx")
                    .body(byteArray);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    
}
