package com.manamer.backend.business.sellout.controller;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import org.apache.poi.hssf.usermodel.HSSFWorkbook;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import com.manamer.backend.business.sellout.models.ExcelUtils;
import com.manamer.backend.business.sellout.models.Cliente;
import com.manamer.backend.business.sellout.models.Producto;
import com.manamer.backend.business.sellout.models.TipoMueble;
import com.manamer.backend.business.sellout.models.Venta;
import com.manamer.backend.business.sellout.repositories.ProductoRepository;
import com.manamer.backend.business.sellout.service.ProductoService;
import com.manamer.backend.business.sellout.service.TipoMuebleService;
import com.manamer.backend.business.sellout.service.VentaService;
import com.manamer.backend.business.sellout.service.ClienteService;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
@RestController
@CrossOrigin(origins = "*", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE})
@RequestMapping("/api/deprati")

public class DepratiController {

    // Logger para registrar eventos y errores
    private static final Logger logger = LoggerFactory.getLogger(DepratiController.class);

    // Inyección de servicios necesarios para la operación del controlador
    private final VentaService ventaService;
    private final ClienteService ClienteService;
    private final ProductoService ProductoService;
    private final TipoMuebleService tipoMuebleService;
    private final ProductoRepository repository;
    /**
     * Constructor con inyección de dependencias para todos los servicios requeridos
     */
    @Autowired
    public DepratiController(
            VentaService ventaService,
            ClienteService ClienteService,
            ProductoService ProductoService,
            TipoMuebleService tipoMuebleService,
            ProductoRepository repository) {
        this.ventaService = ventaService;
        this.ClienteService = ClienteService;
        this.ProductoService = ProductoService;
        this.tipoMuebleService = tipoMuebleService;
        this.repository = repository;
    }
   
    /**
     * Obtiene todas las ventas asociadas al cliente Deprati (ID 5970)
     * Filtra las ventas que no tienen cliente o tienen un cliente diferente
     * @return Lista de ventas del cliente Deprati
     */
    @GetMapping("/venta") // Obtener todas las ventas con cliente asignado en este caso deprati
    public ResponseEntity<List<Venta>> obtenerTodasLasVentas() {
        List<Venta> ventas = ventaService.obtenerTodasLasVentas();
        ventas.removeIf(venta -> venta.getCliente() == null || venta.getCliente().getId() != 5970L);
        return ResponseEntity.ok(ventas);
    }

    /**
     * Obtiene una venta específica por su ID
     * @param id Identificador único de la venta
     * @return La venta encontrada o 404 si no existe
     */
    @GetMapping("/venta/{id}")
    public ResponseEntity<Venta> obtenerVentaPorId(@PathVariable Long id) {
        Optional<Venta> venta = ventaService.obtenerVentaPorId(id);
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


    @PostMapping("/subir-archivos-motor-maping")
    public ResponseEntity<Map<String, Object>> procesarArchivoExcelFlexible(@RequestParam("file") MultipartFile file) {
        Map<String, Object> respuesta = new HashMap<>();

        if (file.isEmpty()) {
            respuesta.put("mensaje", "❌ El archivo está vacío.");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(respuesta);
        }

        int filasLeídas = 0;
        int filasProcesadas = 0;
        Set<String> codigosNoEncontrados = new HashSet<>();


        try (Workbook workbook = obtenerWorkbookCorrecto(file)) {
            Sheet sheet = workbook.getSheetAt(0);
            List<Venta> ventas = new ArrayList<>();

            Map<Integer, String> codPdvMap = new LinkedHashMap<>();
            Map<Integer, String> pdvMap = new LinkedHashMap<>();

            Row rowCodPdv = sheet.getRow(25);
            Row rowPdv = sheet.getRow(26);
            if (rowCodPdv == null || rowPdv == null) {
                respuesta.put("mensaje", "❌ El archivo no tiene las filas necesarias (cod_Pdv/pdv).");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(respuesta);
            }

            for (int col = 12; col <= 44; col += 2) {
                String codPdv = obtenerValorCelda(rowCodPdv.getCell(col), String.class);
                String pdv = obtenerValorCelda(rowPdv.getCell(col), String.class);
                if (codPdv != null && pdv != null && !codPdvMap.containsValue(codPdv)) {
                    codPdvMap.put(col, codPdv);
                    pdvMap.put(col, pdv);
                }
            }

            Row encabezado = sheet.getRow(27);
            if (encabezado == null) {
                respuesta.put("mensaje", "❌ No se encontró fila de encabezados (fila 28 esperada).");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(respuesta);
            }

            Map<String, List<String>> camposEsperados = new HashMap<>();
            camposEsperados.put("marca", List.of(normalizarTexto("Marca"), normalizarTexto("brand"), normalizarTexto("Marcas")));
            camposEsperados.put("nombreProducto", List.of(normalizarTexto("nombre producto"), normalizarTexto("producto"), normalizarTexto("Descripcion"), normalizarTexto("descripciones")));
            camposEsperados.put("codBarra", List.of(normalizarTexto("codigo de barras"), normalizarTexto("cod_barra"), normalizarTexto("No. Mat. Proveedor")));
            camposEsperados.put("fecha", List.of(normalizarTexto("Día natural"), normalizarTexto("fecha"), normalizarTexto("fecha venta"), normalizarTexto("date")));

            Map<String, Integer> columnaPorCampo = new HashMap<>();
            for (Cell celda : encabezado) {
                String valor = obtenerValorCelda(celda, String.class);
                if (valor == null) continue;
                String valorNormalizado = normalizarTexto(valor);
                for (Map.Entry<String, List<String>> entry : camposEsperados.entrySet()) {
                    if (entry.getValue().contains(valorNormalizado)) {
                        columnaPorCampo.put(entry.getKey(), celda.getColumnIndex());
                    }
                }
            }

            for (String campo : camposEsperados.keySet()) {
                if (!columnaPorCampo.containsKey(campo)) {
                    respuesta.put("mensaje", "❌ No se encontró la columna para: " + campo);
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(respuesta);
                }
            }

            for (int i = 29; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;
                filasLeídas++;

                Cell celdaFecha = row.getCell(columnaPorCampo.get("fecha"));
                LocalDate fecha = null;
                try {
                    String fechaTexto = obtenerValorCelda(celdaFecha, String.class);
                    if (fechaTexto != null && !fechaTexto.isBlank()) {
                        String[] formatos = { "dd.MM.yyyy", "dd/MM/yyyy", "dd-MM-yyyy", "yyyy-MM-dd", "yyyy/MM/dd", "d-MMM-yyyy" };
                        for (String formato : formatos) {
                            try {
                                DateTimeFormatter formatter = DateTimeFormatter.ofPattern(formato).withLocale(java.util.Locale.US);
                                fecha = LocalDate.parse(fechaTexto, formatter);
                                break;
                            } catch (Exception ignored) {}
                        }
                    }
                    if (fecha == null && celdaFecha != null && celdaFecha.getCellType() == CellType.NUMERIC) {
                        if (DateUtil.isCellDateFormatted(celdaFecha)) {
                            Date fechaExcel = celdaFecha.getDateCellValue();
                            fecha = fechaExcel.toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
                        }
                    }
                    if (fecha == null) continue;
                } catch (Exception e) {
                    continue;
                }

                String marca = obtenerValorCelda(row.getCell(columnaPorCampo.get("marca")), String.class);
                String nombreProducto = obtenerValorCelda(row.getCell(columnaPorCampo.get("nombreProducto")), String.class);
                String codBarra = obtenerValorCelda(row.getCell(columnaPorCampo.get("codBarra")), String.class);
                String descripcion = nombreProducto;

                if (codBarra == null || codBarra.isEmpty() || codBarra.trim().equalsIgnoreCase("Resultado")) continue;

                for (Map.Entry<Integer, String> entry : codPdvMap.entrySet()) {
                    int col = entry.getKey();
                    String codPdv = entry.getValue();
                    String pdv = pdvMap.get(col);
                    Double ventaUnidades = convertirADoubleSeguro(row.getCell(col), i + 1, col);
                    Double ventaUSD = convertirADoubleSeguro(row.getCell(col + 1), i + 1, col + 1);

                    if (ventaUnidades != null || ventaUSD != null) {
                        Venta venta = new Venta();
                        venta.setAnio(fecha.getYear());
                        venta.setMes(fecha.getMonthValue());
                        venta.setDia(fecha.getDayOfMonth());
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

                        Cliente cliente = new Cliente();
                        cliente.setId(5970L);
                        venta.setCliente(cliente);

                        Producto producto = new Producto();
                        producto.setCodBarraSap(codBarra);
                        venta.setProducto(producto);

                        boolean datosCargados = ventaService.cargarDatosDeProductoDeprati(venta, codigosNoEncontrados);
                        if (!datosCargados) continue;

                        ventas.add(venta);
                        filasProcesadas++;
                    }
                }
            }

            if (ventas.isEmpty()) {
                respuesta.put("mensaje", "⚠️ El archivo se leyó correctamente, pero no se encontraron ventas válidas.");
                respuesta.put("codigosNoEncontrados", codigosNoEncontrados);
                return ResponseEntity.status(HttpStatus.NO_CONTENT).body(respuesta);
            }

            ventaService.guardarVentas(ventas);
            respuesta.put("mensaje", "✅ Se procesaron " + filasProcesadas + " registros de " + filasLeídas + " filas leídas.");
            respuesta.put("codigosNoEncontrados", codigosNoEncontrados);
            return ResponseEntity.ok(respuesta);

        } catch (IOException e) {
            e.printStackTrace();
            respuesta.put("mensaje", "❌ Error al procesar el archivo Excel.");
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(respuesta);
        } catch (Exception e) {
            e.printStackTrace();
            respuesta.put("mensaje", "❌ Error inesperado al procesar.");
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(respuesta);
        }
    }


    public static String normalizarTexto(String input) {
        if (input == null) return null;
        return Normalizer.normalize(input.toLowerCase().trim(), Normalizer.Form.NFD)
                        .replaceAll("\\p{InCombiningDiacriticalMarks}+", "")
                        .replaceAll("[^\\p{ASCII}]", "") // quita cualquier otro símbolo especial
                        .replaceAll("[\\.,\"']", ""); // quita comas, puntos, comillas y apóstrofes
    }

    @PostMapping("/subir-archivo-venta")
    public ResponseEntity<Map<String, Object>> procesarArchivoExcelDeprati(@RequestParam("file") MultipartFile file) {
        Map<String, Object> respuesta = new HashMap<>();

        if (file.isEmpty()) {
            respuesta.put("mensaje", "❌ El archivo está vacío.");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(respuesta);
        }

        int filasLeídas = 0;
        int filasProcesadas = 0;
        Set<String> codigosNoEncontrados = new HashSet<>();

        try (Workbook workbook = obtenerWorkbookCorrecto(file)) {
            Sheet sheet = workbook.getSheetAt(0);
            List<Venta> ventas = new ArrayList<>();

            Map<Integer, String> codPdvMap = new LinkedHashMap<>();
            Map<Integer, String> pdvMap = new LinkedHashMap<>();

            int filaCodPdv = -1;

    // Buscar la fila que contiene celdas con la palabra "Tienda"
    for (int i = 0; i <= sheet.getLastRowNum(); i++) {
        Row row = sheet.getRow(i);
        if (row == null) continue;

                    for (Cell cell : row) {
                        String value = obtenerValorCelda(cell, String.class);
                        if (value != null && value.toLowerCase().contains("tienda")) {
                filaCodPdv = i;
                break;
            }
        }

        if (filaCodPdv != -1) break;
    }

        if (filaCodPdv == -1) {
            respuesta.put("mensaje", "❌ No se encontró una fila con celdas que contengan la palabra 'Tienda'.");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(respuesta);
        }

        Row rowCodPdv = sheet.getRow(filaCodPdv);
        Row rowPdv = sheet.getRow(filaCodPdv + 1); // la fila siguiente

        if (rowPdv == null) {
            respuesta.put("mensaje", "❌ No se encontró la fila siguiente con los nombres de PDV.");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(respuesta);
        }

        // Leer solo las columnas donde hay valores tipo "Tienda"
        for (int col = 0; col < rowCodPdv.getLastCellNum(); col++) {
            String codPdv = obtenerValorCelda(rowCodPdv.getCell(col), String.class);
            if (codPdv == null || !codPdv.toLowerCase().contains("tienda")) continue;

            String pdv = obtenerValorCelda(rowPdv.getCell(col), String.class);

            if (pdv != null && !codPdvMap.containsValue(codPdv)) {
                codPdvMap.put(col, codPdv);
                pdvMap.put(col, pdv);
            }
        }


            for (int i = 29; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;
                filasLeídas++;

                Cell celdaFecha = row.getCell(11);
                LocalDate fecha = null;

                try {
                    String fechaTexto = obtenerValorCelda(celdaFecha, String.class);
                    if (fechaTexto != null && !fechaTexto.isBlank()) {
                        String[] posiblesFormatos = {
                            "dd.MM.yyyy", "dd/MM/yyyy", "dd-MM-yyyy",
                            "yyyy-MM-dd", "yyyy/MM/dd", "d-MMM-yyyy"
                        };
                        for (String formato : posiblesFormatos) {
                            try {
                                DateTimeFormatter formatter = DateTimeFormatter.ofPattern(formato).withLocale(java.util.Locale.US);
                                fecha = LocalDate.parse(fechaTexto, formatter);
                                break;
                            } catch (Exception ignored) {}
                        }
                    }
                    if (fecha == null && celdaFecha != null && celdaFecha.getCellType() == CellType.NUMERIC) {
                        if (DateUtil.isCellDateFormatted(celdaFecha)) {
                            Date fechaExcel = celdaFecha.getDateCellValue();
                            fecha = fechaExcel.toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
                        }
                    }
                    if (fecha == null) continue;
                } catch (Exception e) {
                    continue;
                }

                String marca = obtenerValorCelda(row.getCell(6), String.class);
                String nombreProducto = obtenerValorCelda(row.getCell(9), String.class);
                String codBarra = obtenerValorCelda(row.getCell(10), String.class);
                String descripcion = nombreProducto;

                if (codBarra == null || codBarra.isEmpty() || codBarra.trim().equalsIgnoreCase("Resultado")) {
                    continue;
                }

                for (Map.Entry<Integer, String> entry : codPdvMap.entrySet()) {
                    int col = entry.getKey();
                    String codPdv = entry.getValue();
                    String pdv = pdvMap.get(col);
                    Double ventaUnidades = convertirADoubleSeguro(row.getCell(col), i + 1, col);
                    Double ventaUSD = convertirADoubleSeguro(row.getCell(col + 1), i + 1, col + 1);

                    if (ventaUnidades != null || ventaUSD != null) {
                        Venta venta = new Venta();
                        venta.setAnio(fecha.getYear());
                        venta.setMes(fecha.getMonthValue());
                        venta.setDia(fecha.getDayOfMonth());
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

                        Cliente cliente = new Cliente();
                        cliente.setId(5970L);
                        venta.setCliente(cliente);

                        Producto producto = new Producto();
                        producto.setCodBarraSap(codBarra);
                        venta.setProducto(producto);

                        boolean datosCargados = ventaService.cargarDatosDeProductoDeprati(venta, codigosNoEncontrados);
                        if (!datosCargados) {
                            continue;
                        }

                        ventas.add(venta);
                        filasProcesadas++;
                    }
                }
            }

            if (ventas.isEmpty()) {
                respuesta.put("mensaje", "⚠️ El archivo se leyó correctamente, pero no se encontraron ventas válidas.");
                respuesta.put("codigosNoEncontrados", codigosNoEncontrados);
                return ResponseEntity.status(HttpStatus.NO_CONTENT).body(respuesta);
            }

            ventaService.guardarVentas(ventas);
            respuesta.put("mensaje", "✅ Se procesaron " + filasProcesadas + " registros de " + filasLeídas + " filas leídas.");
            respuesta.put("codigosNoEncontrados", codigosNoEncontrados);
            return ResponseEntity.ok(respuesta);

        } catch (IOException e) {
            e.printStackTrace();
            respuesta.put("mensaje", "❌ Error al procesar el archivo Excel.");
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(respuesta);
        } catch (Exception e) {
            e.printStackTrace();
            respuesta.put("mensaje", "❌ Error inesperado al procesar.");
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(respuesta);
        }
    }


    private Double convertirADoubleSeguro(Cell cell, int fila, int columna) {
        try {
            if (cell == null) return 0.0;
    
            switch (cell.getCellType()) {
                case NUMERIC:
                    return cell.getNumericCellValue();
    
                case STRING:
                    String valor = cell.getStringCellValue().trim()
                            .replace(",", ".")
                            .replaceAll("[^\\d.\\-]", ""); // permite solo números, punto y guion
    
                    if (valor.isEmpty() || valor.equals("-") || valor.equals(".")) {
                        return 0.0;
                    }
    
                    return Double.parseDouble(valor);
    
                case FORMULA:
                    try {
                        return cell.getNumericCellValue();
                    } catch (IllegalStateException e) {
                        String formulaValor = cell.getStringCellValue().trim().replace(",", ".")
                                .replaceAll("[^\\d.\\-]", "");
                        return Double.parseDouble(formulaValor);
                    }
    
                default:
                    return 0.0;
            }
    
        } catch (NumberFormatException e) {
            System.out.println("❌ Error de formato numérico en fila " + fila + ", columna " + columna +
                    ". Valor: '" + obtenerTextoCrudoCelda(cell) + "' => " + e.getMessage());
            return 0.0;
        } catch (Exception e) {
            System.out.println("⚠️ Error inesperado al convertir celda (fila " + fila + ", col " + columna + "): " +
                    e.getMessage() + " | Valor crudo: '" + obtenerTextoCrudoCelda(cell) + "'");
            return 0.0;
        }
    }
     
    private String obtenerTextoCrudoCelda(Cell cell) {
        try {
            return switch (cell.getCellType()) {
                case STRING -> cell.getStringCellValue();
                case NUMERIC -> String.valueOf(cell.getNumericCellValue());
                case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
                case FORMULA -> cell.getCellFormula();
                default -> "";
            };
        } catch (Exception e) {
            return "¿Valor ilegible?";
        }
    }    

    private Workbook obtenerWorkbookCorrecto(MultipartFile file) throws IOException {
        String nombreArchivo = file.getOriginalFilename();
            if (nombreArchivo != null && nombreArchivo.toLowerCase().endsWith(".xls")) {
                return new HSSFWorkbook(file.getInputStream());}
                 else if (nombreArchivo != null && nombreArchivo.toLowerCase().endsWith(".xlsx")) {
                return new XSSFWorkbook(file.getInputStream());}
                 else {
                throw new IllegalArgumentException("Formato de archivo no soportado: " + nombreArchivo);
            }
    }

    private <T> T obtenerValorCelda(org.apache.poi.ss.usermodel.Cell cell, Class<T> clazz) {
        if (cell == null) return null;

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
                        return clazz.cast(Integer.parseInt(value));
                    } else if (clazz == Double.class) {
                        return clazz.cast(Double.parseDouble(value));
                    } else {
                        return clazz.cast(value);
                    }
                case BLANK:
                    return null;
                default:
                    return null;
            }
        } catch (Exception e) {
            System.err.println("Error al convertir celda: " + cell.toString());
            e.printStackTrace();
        }
        return null;
    }
    
    //CRUD de tabla Tipo Mueble

    @GetMapping("/tipo-mueble")
    public ResponseEntity<List<TipoMueble>> obtenerTiposMueblePorCliente() {
        Long idCliente = 5970L;
        List<TipoMueble> tiposMueble = tipoMuebleService.obtenerTiposMueblePorCliente(idCliente);
        return ResponseEntity.ok(tiposMueble);
    }

    /**
     * Crea un nuevo tipo de mueble
     * @param tipoMueble Datos del tipo de mueble a crear
     * @return El tipo de mueble creado con su ID asignado
     */
    @PostMapping("/tipo-mueble")
    public ResponseEntity<TipoMueble> crearTipoMueble(@RequestBody TipoMueble tipoMueble) {
        TipoMueble nuevoTipoMueble = tipoMuebleService.guardarTipoMueble(tipoMueble);
        return ResponseEntity.ok(nuevoTipoMueble);
    }

    /**
     * Obtiene un tipo de mueble específico por su ID
     * @param id Identificador del tipo de mueble
     * @return El tipo de mueble encontrado o 404 si no existe
     */
    @GetMapping("/tipo-mueble/{id}")
    public ResponseEntity<TipoMueble> obtenerTipoMueblePorId(@PathVariable Long id) {
        Optional<TipoMueble> tipoMueble = tipoMuebleService.obtenerTipoMueblePorId(id);
        return tipoMueble.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }

    /**
     * Actualiza un tipo de mueble existente
     * @param id ID del tipo de mueble a actualizar
     * @param nuevoTipoMueble Datos actualizados
     * @return El tipo de mueble actualizado o 404 si no se encuentra
     */
    @PutMapping("/tipo-mueble/{id}")
    public ResponseEntity<TipoMueble> actualizarTipoMueble(@PathVariable Long id, @RequestBody TipoMueble nuevoTipoMueble) {
        try {
            TipoMueble tipoMuebleActualizado = tipoMuebleService.actualizarTipoMueble(id, nuevoTipoMueble);
            return ResponseEntity.ok(tipoMuebleActualizado);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Elimina un tipo de mueble por su ID
     * @param id Identificador del tipo de mueble a eliminar
     * @return 200 OK si se eliminó correctamente, 404 si no se encuentra
     */
    @DeleteMapping("/tipo-mueble/{id}")
    public ResponseEntity<Void> eliminarTipoMueble(@PathVariable Long id) {
        if (tipoMuebleService.eliminarTipoMueble(id)) {
            return ResponseEntity.ok().build();
        } else {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Procesa un archivo Excel con datos de tipos de mueble
     * @param file Archivo Excel con el formato específico para tipos de mueble
     * @return Lista de tipos de mueble procesados y guardados
     */
    @PostMapping("/template-tipo-muebles")
    public ResponseEntity<List<TipoMueble>> subirTipoMuebles(@RequestParam("file") MultipartFile file) {
        List<TipoMueble> tipoMuebles = tipoMuebleService.cargarTipoMueblesDesdeArchivoDeprati(file);
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

    /**
     * Convierte un workbook de Excel a un array de bytes
     * Utilidad para generar reportes descargables
     * @param workbook Libro de Excel a convertir
     * @return Array de bytes con el contenido del libro
     */
    public static byte[] convertWorkbookToByteArray(XSSFWorkbook workbook) throws IOException {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            workbook.write(out);
            return out.toByteArray();
        }
    }  

    /**
     * Genera un reporte Excel con todos los tipos de mueble de Deprati
     * @return Archivo Excel descargable con el reporte
     */
    @GetMapping("/reporte-tipo-mueble")
    public ResponseEntity<byte[]> generarReporteTipoMueble() {
        try {
             // Obtener tipos de mueble solo para el cliente con ID 5970
             Long idCliente = 5970L;
            // Obtener todos los tipos de mueble
            List<TipoMueble> tiposMueble = tipoMuebleService.obtenerTodosLosTiposMuebleDeprati();


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
            header.createCell(7).setCellValue("Marca");

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
                row.createCell(7).setCellValue(tipoMueble.getMarca());
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

    @PostMapping("/cargar-excel")
    public ResponseEntity<String> cargarVentasDesdeExcel(
            @RequestParam("archivo") MultipartFile archivo,
            @RequestParam("filaInicio") int filaInicio,
            @RequestParam("columnaCodBarra") int columnaCodBarra,
            @RequestParam("columnaMarca") int columnaMarca,
            @RequestParam("columnaProducto") int columnaProducto,
            @RequestParam("columnaDescripcion") int columnaDescripcion,
            @RequestParam("columnaCodPdv") int columnaCodPdv,
            @RequestParam("columnaPdv") int columnaPdv,
            @RequestParam("columnaUnidades") int columnaUnidades,
            @RequestParam("columnaDolares") int columnaDolares,
            @RequestParam("columnaFecha") int columnaFecha
    ) {
        try {
            Map<String, Integer> mapeoColumnas = new HashMap<>();
            mapeoColumnas.put("codBarra", columnaCodBarra);
            mapeoColumnas.put("marca", columnaMarca);
            mapeoColumnas.put("producto", columnaProducto);
            mapeoColumnas.put("descripcion", columnaDescripcion);
            mapeoColumnas.put("codPdv", columnaCodPdv);
            mapeoColumnas.put("pdv", columnaPdv);
            mapeoColumnas.put("unidades", columnaUnidades);
            mapeoColumnas.put("dolares", columnaDolares);
            mapeoColumnas.put("fecha", columnaFecha);

            boolean resultado = ventaService.cargarVentasDesdeExcel(archivo.getInputStream(), mapeoColumnas, filaInicio);

            if (resultado) {
                return ResponseEntity.ok("Archivo procesado correctamente");
            } else {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error al procesar el archivo");
            }

        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error al leer el archivo: " + e.getMessage());
        }
    }

}
