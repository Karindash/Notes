---
doc_id: spring-boot-structure-guide
title: Struktur Project Java Spring Boot dan Roadmap Pengembangan
language: id
framework: Spring Boot 3.x
java_version: 17+
build_tool: Maven | Gradle
audience: pemula yang sudah pernah belajar Spring
sections: [S1, S2, S3, S4, S5, S6, S7]
---

# Struktur Project Java Spring Boot dan Roadmap Pengembangan

> Konvensi dokumen: setiap bagian punya ID stabil (`S1`, `S2.1`, ...) dan setiap item penting punya kode unik (`STR-01`, `PATH-01`, `PH-01`, `MIG-01`, `RULE-01`) agar mudah dirujuk, diekstrak, atau dijadikan input perintah berikutnya.

---

## S1. Ringkasan Cepat (Machine-Readable)

```yaml
structures:
  - id: STR-01
    name: Package by Layer
    grouping: jenis teknis
    scale: kecil (5-10 entity)
  - id: STR-02
    name: Package by Feature
    grouping: fitur bisnis
    scale: menengah
  - id: STR-03
    name: Hexagonal
    grouping: domain di pusat, port dan adapter
    scale: domain kompleks
  - id: STR-04
    name: Spring Modulith
    grouping: modul dengan batas terverifikasi
    scale: monolith besar

development_paths:
  - {id: PATH-01, name: Bottom-Up, order: "Entity > Repository > Service > DTO > Controller > ExceptionHandler"}
  - {id: PATH-02, name: Top-Down, order: "API Contract/DTO > Controller > Service > Repository > Entity"}
  - {id: PATH-03, name: Thin Slice, order: "satu fitur minimal di semua lapisan, lalu iterasi"}
  - {id: PATH-04, name: TDD, order: "Test > Implementasi > Refactor"}

roadmap:
  - {phase: PH-01, structure: Package by Layer, path: Bottom-Up, focus: "CRUD satu entity"}
  - {phase: PH-02, structure: Package by Layer, path: Bottom-Up, focus: "DTO, validasi, exception handler, MapStruct"}
  - {phase: PH-03, structure: Package by Layer, path: Thin Slice, focus: "relasi, pagination, sorting, search"}
  - {phase: PH-04, structure: Package by Layer, path: Thin Slice, focus: "Spring Security JWT, profile, Flyway"}
  - {phase: PH-05, structure: Package by Layer, path: TDD, focus: "Mockito, WebMvcTest, DataJpaTest"}
  - {phase: PH-06, structure: Package by Layer, path: Thin Slice, focus: "Docker, springdoc-openapi, logging"}
  - {phase: PH-07, structure: Package by Feature, path: Thin Slice, focus: "migrasi struktur saat >5-10 entity"}
  - {phase: PH-08, structure: Modular Monolith, path: Thin Slice, focus: "batas modul, ArchUnit/Modulith, schema per fitur, event"}
  - {phase: PH-09, structure: Hybrid/Microservices, path: Strangler Fig, focus: "ekstraksi bertahap"}
```

---

## S2. Perbandingan Empat Struktur

| ID | Struktur | Pengelompokan | Keunggulan | Kelemahan | Skala |
|---|---|---|---|---|---|
| STR-01 | Package by Layer | Per jenis teknis | Sederhana, familiar, cepat untuk CRUD | Fitur tersebar, enkapsulasi lemah (semua class `public`) | Kecil |
| STR-02 | Package by Feature | Per fitur bisnis | High cohesion, package-private, mudah dipecah, minim merge conflict | Perlu disiplin dependensi antar fitur | Menengah |
| STR-03 | Hexagonal | Domain di pusat | Domain bebas framework, testability tinggi, infrastruktur mudah diganti | Boilerplate banyak (mapper, interface) | Kompleks |
| STR-04 | Spring Modulith | Modul dengan batas terverifikasi | Batas divalidasi test, komunikasi via event, dokumentasi otomatis | Ekosistem lebih baru, perlu konsep event | Besar |

### S2.1 STR-01 Package by Layer

```
com.example.app
├── controller        # menerima request, mengembalikan response
├── service           # logika bisnis
│   └── impl          # opsional, hanya bila ada >1 implementasi
├── repository        # akses database (Spring Data JPA)
├── entity            # representasi tabel
├── dto
│   ├── request
│   └── response
├── mapper            # konversi entity <-> DTO
├── exception         # custom exception + global handler
├── config            # security, CORS, dll.
└── util              # helper/konstanta
```

```yaml
dependency_rule: "Controller -> Service -> Repository -> Entity"
forbidden:
  - Controller memanggil Repository langsung
  - Entity dikirim sebagai response API
```

### S2.2 STR-02 Package by Feature

```
com.example.app
├── Application.java
├── user
│   ├── UserController.java
│   ├── UserService.java
│   ├── UserRepository.java
│   ├── User.java
│   └── dto
│       ├── UserRequest.java
│       └── UserResponse.java
├── order
│   ├── OrderController.java
│   ├── OrderService.java
│   ├── OrderRepository.java
│   └── Order.java
├── product
└── common
    ├── config
    ├── exception
    └── util
```

Contoh enkapsulasi (package-private, hanya controller yang publik):

```java
package com.example.app.order;

@RestController
@RequestMapping("/api/orders")
public class OrderController {            // public: pintu masuk HTTP
    private final OrderService service;

    OrderController(OrderService service) { this.service = service; }

    @GetMapping("/{id}")
    OrderResponse get(@PathVariable Long id) { return service.findById(id); }
}

@Service
class OrderService {                       // package-private
    private final OrderRepository repository;
    OrderService(OrderRepository repository) { this.repository = repository; }
    OrderResponse findById(Long id) { /* ... */ return null; }
}

interface OrderRepository extends JpaRepository<Order, Long> {}   // package-private
```

### S2.3 STR-03 Hexagonal

```
com.example.app.order
├── domain
│   ├── model          # Order, OrderItem (POJO murni)
│   └── service        # logika domain murni
├── application
│   ├── port
│   │   ├── in         # PlaceOrderUseCase
│   │   └── out        # OrderRepositoryPort, PaymentPort
│   └── service        # implementasi use case
└── adapter
    ├── in.web         # OrderController, request/response DTO
    └── out
        ├── persistence  # JPA entity, adapter, mapper
        └── payment      # client payment gateway
```

```java
// port in
public interface PlaceOrderUseCase {
    OrderId place(PlaceOrderCommand command);
}

// port out
public interface OrderRepositoryPort {
    void save(Order order);
}

// application service (tanpa import Spring Data / JPA)
class PlaceOrderService implements PlaceOrderUseCase {
    private final OrderRepositoryPort repository;
    PlaceOrderService(OrderRepositoryPort repository) { this.repository = repository; }

    public OrderId place(PlaceOrderCommand c) {
        Order order = Order.create(c.customerId(), c.items());
        repository.save(order);
        return order.id();
    }
}
```

### S2.4 STR-04 Spring Modulith

```
com.example.app
├── Application.java
├── order
│   ├── Order.java            # API publik modul
│   ├── OrderService.java
│   └── internal              # tidak boleh diakses modul lain
├── inventory
│   ├── InventoryApi.java
│   └── internal
└── notification
    └── internal
```

```java
// Verifikasi batas modul di test
class ModularityTests {
    @Test
    void verifyModules() {
        ApplicationModules.of(Application.class).verify();
    }
}
```

```java
// Komunikasi antar modul lewat event
@Service
class OrderService {
    private final ApplicationEventPublisher events;
    OrderService(ApplicationEventPublisher events) { this.events = events; }

    @Transactional
    void complete(Order order) {
        // ... ubah status
        events.publishEvent(new OrderCompleted(order.getId()));
    }
}

@Component
class NotificationListener {
    @ApplicationModuleListener
    void on(OrderCompleted event) { /* kirim notifikasi */ }
}
```

---

## S3. Jalur Pengembangan Package by Layer

Contoh domain yang dipakai: entity `Product`.

### S3.1 PATH-01 Bottom-Up

**Urutan:** Entity > Repository > Service > DTO > Controller > Exception Handler

| Langkah | Artefak | Contoh |
|---|---|---|
| 1 | Entity | `Product` |
| 2 | Repository | `ProductRepository` |
| 3 | Service | `ProductService` |
| 4 | DTO + Mapper | `ProductRequest`, `ProductResponse` |
| 5 | Controller | `ProductController` |
| 6 | Exception handler | `GlobalExceptionHandler` |

```java
// 1. entity/Product.java
@Entity
@Table(name = "products")
public class Product {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal price;

    // getter dan setter
}

// 2. repository/ProductRepository.java
public interface ProductRepository extends JpaRepository<Product, Long> {
    List<Product> findByNameContainingIgnoreCase(String name);
}

// 3. service/ProductService.java
@Service
public class ProductService {
    private final ProductRepository repository;
    private final ProductMapper mapper;

    public ProductService(ProductRepository repository, ProductMapper mapper) {
        this.repository = repository;
        this.mapper = mapper;
    }

    @Transactional(readOnly = true)
    public ProductResponse findById(Long id) {
        return repository.findById(id)
                .map(mapper::toResponse)
                .orElseThrow(() -> new ResourceNotFoundException("Product " + id + " tidak ditemukan"));
    }

    @Transactional
    public ProductResponse create(ProductRequest request) {
        Product saved = repository.save(mapper.toEntity(request));
        return mapper.toResponse(saved);
    }
}

// 4. dto/request/ProductRequest.java
public record ProductRequest(
        @NotBlank String name,
        @NotNull @Positive BigDecimal price) {}

// 4. dto/response/ProductResponse.java
public record ProductResponse(Long id, String name, BigDecimal price) {}

// 4. mapper/ProductMapper.java (MapStruct)
@Mapper(componentModel = "spring")
public interface ProductMapper {
    Product toEntity(ProductRequest request);
    ProductResponse toResponse(Product product);
}

// 5. controller/ProductController.java
@RestController
@RequestMapping("/api/products")
public class ProductController {
    private final ProductService service;
    public ProductController(ProductService service) { this.service = service; }

    @GetMapping("/{id}")
    public ProductResponse get(@PathVariable Long id) { return service.findById(id); }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProductResponse create(@Valid @RequestBody ProductRequest request) {
        return service.create(request);
    }
}

// 6. exception/GlobalExceptionHandler.java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ErrorResponse notFound(ResourceNotFoundException ex) {
        return new ErrorResponse("NOT_FOUND", ex.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorResponse invalid(MethodArgumentNotValidException ex) {
        String msg = ex.getBindingResult().getFieldErrors().stream()
                .map(e -> e.getField() + ": " + e.getDefaultMessage())
                .collect(Collectors.joining(", "));
        return new ErrorResponse("VALIDATION_ERROR", msg);
    }
}

public record ErrorResponse(String code, String message) {}
```

| Aspek | Isi |
|---|---|
| Keunggulan | Alur natural, tiap lapisan bisa diuji, mudah dipahami |
| Kelemahan | API mengikuti bentuk tabel, hasil end-to-end baru terlihat di akhir, risiko entity bocor ke controller |
| Cocok untuk | CRUD pertama, skema database sudah ada |

### S3.2 PATH-02 Top-Down

**Urutan:** Kontrak API/DTO > Controller (data dummy) > Service > Repository > Entity

```java
// Langkah 1-3: kontrak + controller dengan data dummy
@RestController
@RequestMapping("/api/products")
public class ProductController {
    @GetMapping
    public List<ProductResponse> list() {
        return List.of(new ProductResponse(1L, "Dummy", new BigDecimal("10000")));
    }
}

// Langkah 4: ganti dummy dengan pemanggilan service
@GetMapping
public List<ProductResponse> list() { return service.findAll(); }
```

| Aspek | Isi |
|---|---|
| Keunggulan | API dirancang dari sisi pengguna, frontend bisa mulai lebih awal, DTO terpisah sejak awal |
| Kelemahan | Perlu desain API di awal, risiko tidak cocok dengan database, lebih abstrak |
| Cocok untuk | Frontend/mobile terpisah, kerja tim |

### S3.3 PATH-03 Thin Slice

| Iterasi | Cakupan | Output yang bisa dijalankan |
|---|---|---|
| 1 | `GET /products` (list) dari entity sampai controller | List produk |
| 2 | `POST /products` | Membuat produk |
| 3 | Validasi + error handling | Respons error seragam |
| 4 | Update, delete, pagination | CRUD lengkap |

```java
// Iterasi 4: pagination
@GetMapping
public Page<ProductResponse> list(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "10") int size,
        @RequestParam(defaultValue = "id,asc") String[] sort) {
    Pageable pageable = PageRequest.of(page, size,
            Sort.by(Sort.Order.by(sort[0]).with(Sort.Direction.fromString(sort[1]))));
    return service.findAll(pageable);
}
```

| Aspek | Isi |
|---|---|
| Keunggulan | Selalu ada hasil yang berjalan, bug terdeteksi dini, melatih kerja iteratif |
| Kelemahan | Perlu disiplin antar lapisan, refactor lebih sering |
| Cocok untuk | Setelah dasar CRUD dikuasai (jalur utama berikutnya) |

### S3.4 PATH-04 TDD

**Urutan:** Test gagal > implementasi minimal > test lulus > refactor

```java
// Unit test service (Mockito)
@ExtendWith(MockitoExtension.class)
class ProductServiceTest {
    @Mock ProductRepository repository;
    @Mock ProductMapper mapper;
    @InjectMocks ProductService service;

    @Test
    void findById_notFound_throwsException() {
        when(repository.findById(99L)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> service.findById(99L));
    }
}

// Test controller (slice)
@WebMvcTest(ProductController.class)
class ProductControllerTest {
    @Autowired MockMvc mockMvc;
    @MockBean ProductService service;

    @Test
    void create_invalidPayload_returns400() throws Exception {
        mockMvc.perform(post("/api/products")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"\",\"price\":-1}"))
               .andExpect(status().isBadRequest());
    }
}

// Test repository (slice)
@DataJpaTest
class ProductRepositoryTest {
    @Autowired ProductRepository repository;

    @Test
    void findByNameContainingIgnoreCase_returnsMatch() {
        // simpan data, lalu assert hasil query
    }
}
```

| Aspek | Isi |
|---|---|
| Keunggulan | Refactor aman, perilaku terdefinisi sebelum implementasi, test sebagai dokumentasi |
| Kelemahan | Kurva belajar (JUnit, Mockito), awal terasa lambat |
| Cocok untuk | Tahap lanjutan setelah CRUD lengkap |

### S3.5 Perbandingan Jalur

| Kriteria | PATH-01 | PATH-02 | PATH-03 | PATH-04 |
|---|---|---|---|---|
| Kemudahan | Sangat mudah | Sedang | Mudah-sedang | Sulit |
| Kecepatan lihat hasil | Lambat | Sedang | Cepat | Lambat di awal |
| Kualitas desain API | Cukup | Sangat baik | Baik | Baik |
| Kualitas jangka panjang | Cukup | Baik | Baik | Sangat baik |

---

## S4. Roadmap Pengembangan (Detail per Fase)

### PH-01 Package by Layer, Bottom-Up: CRUD satu entity

- Output: CRUD `Product` dengan database H2 atau PostgreSQL
- Dependency Maven:

```xml
<dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId></dependency>
<dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-data-jpa</artifactId></dependency>
<dependency><groupId>org.postgresql</groupId><artifactId>postgresql</artifactId><scope>runtime</scope></dependency>
```

```yaml
# application.yml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/appdb
    username: app
    password: secret
  jpa:
    hibernate:
      ddl-auto: validate
    open-in-view: false
```

### PH-02 DTO, validasi, exception handler, MapStruct

- Output: DTO terpisah dari entity, `@Valid`, `@RestControllerAdvice`, MapStruct
- Dependency tambahan: `spring-boot-starter-validation`, `org.mapstruct:mapstruct`, `mapstruct-processor`

### PH-03 Relasi, pagination, sorting, pencarian

```java
@Entity
public class Product {
    // ...
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;
}

public interface ProductRepository extends JpaRepository<Product, Long> {
    @EntityGraph(attributePaths = "category")          // hindari N+1
    Page<Product> findByNameContainingIgnoreCase(String name, Pageable pageable);
}
```

### PH-04 Security, profile, Flyway

```
src/main/resources
├── application.yml
├── application-dev.yml
├── application-prod.yml
└── db/migration
    ├── V1__create_products.sql
    └── V2__create_categories.sql
```

```sql
-- V1__create_products.sql
CREATE TABLE products (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price NUMERIC(12,2) NOT NULL
);
```

```java
@Configuration
@EnableWebSecurity
class SecurityConfig {
    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(a -> a
                .requestMatchers("/api/auth/**").permitAll()
                .anyRequest().authenticated())
            .oauth2ResourceServer(o -> o.jwt(Customizer.withDefaults()))
            .build();
    }
}
```

### PH-05 Testing (TDD)

- Unit test service: Mockito
- Slice test: `@WebMvcTest`, `@DataJpaTest`
- Contoh kode: lihat S3.4

### PH-06 Siap deploy

```dockerfile
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY target/app.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

- Dokumentasi API: `org.springdoc:springdoc-openapi-starter-webmvc-ui` (Swagger UI di `/swagger-ui.html`)
- Logging: SLF4J, level per profile

### PH-07 Migrasi ke Package by Feature

**Pemicu:** jumlah entity melewati 5 sampai 10, atau satu fitur menyebar di banyak folder.

| Sebelum (layer) | Sesudah (feature) |
|---|---|
| `controller/ProductController` | `product/ProductController` |
| `service/ProductService` | `product/ProductService` |
| `repository/ProductRepository` | `product/ProductRepository` |
| `entity/Product` | `product/Product` |
| `dto/request/ProductRequest` | `product/dto/ProductRequest` |
| `exception/*`, `config/*` | `common/exception`, `common/config` |

Langkah: pindahkan per fitur (satu fitur per commit), ubah class internal menjadi package-private, jalankan test setiap pemindahan.

### PH-08 Modular Monolith

```java
// ArchUnit: fitur lain tidak boleh mengakses repository fitur order
@AnalyzeClasses(packages = "com.example.app")
class ArchitectureTest {
    @ArchTest
    static final ArchRule order_repository_is_private_to_order =
        noClasses().that().resideOutsideOfPackage("..order..")
                   .should().dependOnClassesThat().haveSimpleNameEndingWith("OrderRepository");
}
```

Perubahan wajib pada fase ini:

| ID | Perubahan | Sebelum | Sesudah |
|---|---|---|---|
| MOD-01 | Hapus relasi JPA lintas fitur | `@ManyToOne User user` | `Long userId` |
| MOD-02 | Satu pintu API publik per fitur | Akses langsung ke `UserRepository` | Panggil `UserApi` |
| MOD-03 | Komunikasi asinkron via event | Panggil service lain langsung | `ApplicationEventPublisher` |
| MOD-04 | Schema terpisah per fitur | Satu schema `public` | `order_schema`, `user_schema` |
| MOD-05 | Hapus foreign key dan join lintas schema | `JOIN users` di query order | Ambil data user via `UserApi` |

```java
// MOD-02: API publik fitur user
public interface UserApi {
    Optional<UserSummary> findSummary(Long userId);
}
public record UserSummary(Long id, String name) {}

// Pemakaian di fitur order
@Service
class OrderService {
    private final UserApi userApi;
    OrderService(UserApi userApi) { this.userApi = userApi; }

    void place(Long userId) {
        userApi.findSummary(userId).orElseThrow(() -> new IllegalArgumentException("User tidak ada"));
    }
}
```

### PH-09 Hybrid / Microservices (Strangler Fig)

Lihat S5.

---

## S5. Migrasi ke Microservices (Strangler Fig)

### S5.1 Prasyarat (cek sebelum mulai)

```yaml
reasons_to_migrate:
  - Satu fitur butuh scaling berbeda dari fitur lain
  - Tim besar dan saling menghambat saat deploy
  - Satu bagian butuh teknologi atau siklus rilis berbeda
  - Kegagalan satu fitur tidak boleh menjatuhkan seluruh aplikasi
```

### S5.2 Tahapan

| ID | Tahap | Aktivitas |
|---|---|---|
| MIG-01 | Perkuat batas fitur | Package-private, satu API publik, tanpa relasi JPA lintas fitur, ArchUnit/Modulith di CI |
| MIG-02 | Pisahkan data | Schema per fitur, tanpa foreign key lintas fitur |
| MIG-03 | Pilih kandidat pertama | Dependensi rendah: notification, email, report, file |
| MIG-04 | Ekstrak | Dua implementasi interface, API Gateway, feature flag/canary, hapus kode lama |
| MIG-05 | Fondasi infrastruktur | Gateway, auth terpusat, observability, circuit breaker, Docker, CI/CD, messaging |
| MIG-06 | Konsistensi data | Saga, outbox, idempotency, eventual consistency |

### S5.3 Pemilihan Kandidat

| Kandidat awal yang cocok | Kandidat yang belum cocok |
|---|---|
| Notification, Email, Report, File/Media | Order, Payment, Inventory |
| Dependensi masuk sedikit | Transaksi lintas banyak fitur |
| Data mandiri | Data inti dipakai semua fitur |

### S5.4 Contoh Ekstraksi Notification (Branch by Abstraction)

```java
// 1. Interface publik (sudah ada dari MIG-01)
public interface NotificationApi {
    void send(NotificationCommand command);
}

// 2a. Implementasi lokal (in-process), dipakai sebelum ekstraksi
@Service
@ConditionalOnProperty(name = "notification.mode", havingValue = "local", matchIfMissing = true)
class LocalNotificationApi implements NotificationApi {
    public void send(NotificationCommand command) { /* logika lama */ }
}

// 2b. Implementasi remote, dipakai setelah service terpisah berjalan
@Service
@ConditionalOnProperty(name = "notification.mode", havingValue = "remote")
class RemoteNotificationApi implements NotificationApi {
    private final RestClient client;

    RemoteNotificationApi(RestClient.Builder builder,
                          @Value("${notification.service-url}") String baseUrl) {
        this.client = builder.baseUrl(baseUrl).build();
    }

    public void send(NotificationCommand command) {
        client.post().uri("/api/notifications").body(command).retrieve().toBodilessEntity();
    }
}
```

```yaml
# Peralihan lewat konfigurasi (rollback = ganti kembali ke local)
notification:
  mode: remote
  service-url: http://notification-service:8081
```

```yaml
# Spring Cloud Gateway: sebagian traffic ke service baru
spring:
  cloud:
    gateway:
      routes:
        - id: notification
          uri: http://notification-service:8081
          predicates: [Path=/api/notifications/**]
        - id: monolith
          uri: http://monolith:8080
          predicates: [Path=/api/**]
```

```
Client -> API Gateway --+--> Monolith (order, user, product)
                        +--> Notification Service (baru, DB sendiri)
```

### S5.5 Pola Konsistensi Data

| Pola | Masalah yang diselesaikan | Ringkasan |
|---|---|---|
| Saga | Transaksi lintas service | Rangkaian transaksi lokal dengan langkah kompensasi saat gagal |
| Outbox | Simpan data dan kirim event harus konsisten | Event ditulis ke tabel outbox dalam transaksi yang sama, lalu dikirim terpisah |
| Idempotency | Pesan bisa terkirim lebih dari sekali | Consumer mengabaikan pesan yang sudah diproses (kunci dedup) |
| Eventual consistency | Tidak ada transaksi global | Data konsisten setelah jeda singkat, diterima oleh bisnis |

```java
// Outbox: simpan order + event dalam satu transaksi
@Transactional
public void placeOrder(Order order) {
    orderRepository.save(order);
    outboxRepository.save(new OutboxEvent("OrderPlaced", toJson(order)));
}
// Proses terpisah (scheduler/CDC) membaca outbox dan mempublikasikan ke Kafka/RabbitMQ
```

### S5.6 Keunggulan dan Kelemahan

| Keunggulan | Kelemahan |
|---|---|
| Risiko rendah, sistem tetap berjalan | Durasi panjang (bulan sampai tahun) |
| Bisa berhenti di titik hybrid | Operasional ganda selama transisi |
| Tahap awal meningkatkan kualitas kode | Kompleksitas distributed system |
| Nilai bisnis tetap mengalir | Pemisahan data sulit |
| Batas fitur sudah terdefinisi dari package by feature | Biaya infrastruktur dan DevOps naik |

### S5.7 Perbandingan Pendekatan Migrasi

| Pendekatan | Keunggulan | Kelemahan |
|---|---|---|
| Strangler Fig bertahap | Aman, bisa dihentikan kapan saja | Lama, hidup ganda |
| Big-bang rewrite | Arsitektur bersih sejak awal | Risiko sangat tinggi |
| Tetap modular monolith | Sederhana, murah, deploy mudah | Scaling per fitur terbatas |
| Hybrid | Manfaat tepat sasaran | Perlu tata kelola jelas |

---

## S6. Aturan Praktik Lintas Struktur

| ID | Aturan | Contoh singkat |
|---|---|---|
| RULE-01 | DTO terpisah dari entity | `ProductResponse`, bukan `Product`, sebagai return controller |
| RULE-02 | Constructor injection | `public X(Y y) { this.y = y; }`, bukan `@Autowired` di field |
| RULE-03 | Satu `@RestControllerAdvice` global | Format error seragam `{code, message}` |
| RULE-04 | MapStruct untuk mapping | `@Mapper(componentModel = "spring")` |
| RULE-05 | Konfigurasi per profile | `application-dev.yml`, `application-prod.yml` |
| RULE-06 | Migrasi database via Flyway/Liquibase | `V1__create_products.sql` |
| RULE-07 | ArchUnit untuk aturan arsitektur | Lihat PH-08 |
| RULE-08 | `@Transactional` pada operasi yang mengubah data | `readOnly = true` untuk query |
| RULE-09 | Hindari N+1 query | `@EntityGraph` atau `JOIN FETCH` |
| RULE-10 | `spring.jpa.open-in-view=false` | Cegah lazy loading di lapisan web |
| RULE-11 | Interface service hanya bila ada >1 implementasi | Hindari `XService` + `XServiceImpl` tanpa alasan |
| RULE-12 | Logika bisnis hanya di service | Controller hanya HTTP, repository hanya data |

### S6.1 Anti-Pola

| ID | Anti-pola | Dampak | Perbaikan |
|---|---|---|---|
| ANTI-01 | Entity dikirim langsung sebagai response | Kebocoran data, loop serialisasi relasi | Gunakan DTO (RULE-01) |
| ANTI-02 | Logika bisnis di controller | Sulit diuji dan dipakai ulang | Pindahkan ke service |
| ANTI-03 | Service gemuk (ratusan baris) | Sulit dirawat | Pecah per use case |
| ANTI-04 | Lupa `@Transactional` | Data tidak konsisten | RULE-08 |
| ANTI-05 | Relasi JPA lintas fitur | Menghambat pemisahan service | Simpan ID saja (MOD-01) |
| ANTI-06 | Query N+1 | Performa buruk | RULE-09 |

---

## S7. Matriks Keputusan

| Kondisi | Struktur yang dipilih |
|---|---|
| Project kecil, 5-10 entity, CRUD | STR-01 Package by Layer |
| Entity >10, fitur mulai tersebar | STR-02 Package by Feature |
| Domain kompleks, umur panjang, tim besar | STR-03 Hexagonal atau STR-04 Modulith |
| Perlu batas modul ditegakkan otomatis | STR-04 Spring Modulith |
| Ada kebutuhan scaling/tim/isolasi kegagalan per fitur | Hybrid / Microservices (S5) |

```yaml
decision_flow:
  - if: "entity <= 10 and domain sederhana"
    then: STR-01
  - if: "entity > 10 or fitur tersebar"
    then: STR-02
  - if: "domain kompleks atau butuh isolasi framework"
    then: STR-03
  - if: "butuh verifikasi batas modul otomatis"
    then: STR-04
  - if: "ada alasan konkret scaling/tim/isolasi kegagalan"
    then: "Hybrid/Microservices via Strangler Fig"
```

---

## Lampiran: Daftar Kode Rujukan

| Prefix | Makna | Rentang |
|---|---|---|
| STR | Struktur project | STR-01 s.d. STR-04 |
| PATH | Jalur pengembangan | PATH-01 s.d. PATH-04 |
| PH | Fase roadmap | PH-01 s.d. PH-09 |
| MOD | Perubahan modular monolith | MOD-01 s.d. MOD-05 |
| MIG | Tahap migrasi microservices | MIG-01 s.d. MIG-06 |
| RULE | Aturan praktik | RULE-01 s.d. RULE-12 |
| ANTI | Anti-pola | ANTI-01 s.d. ANTI-06 |
