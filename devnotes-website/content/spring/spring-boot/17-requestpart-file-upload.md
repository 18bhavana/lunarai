---
title: "@RequestPart, MultipartFile and File Upload"
subtitle: multipart/form-data, MultipartFile, single and multiple uploads, JSON + file together, @RequestParam vs @RequestPart vs @ModelAttribute, validation, security, streaming and size limits.
order: 17
---

## Introduction

> [!NOTE]
> **Interview importance: 10/10.**

File upload is one of the most common enterprise requirements — profile pictures, resumes, Excel and CSV imports, PDFs, images, documents and ZIP files.

Interviewers frequently ask: What is `MultipartFile`? What is `multipart/form-data`? What's the difference between `@RequestParam`, `@RequestPart` and `@ModelAttribute`? How does Spring parse uploaded files? Which component handles multipart requests? How do we upload JSON and files together? How do we validate uploads? How do we upload multiple files?

## Why @RequestBody Doesn't Work

Suppose we want to upload **user details (JSON) + a profile picture**. This can't be sent as `Content-Type: application/json`, because JSON can't carry raw binary file data in a standard request. Instead, **`multipart/form-data`** is used.

## What is multipart/form-data?

A multipart request contains **multiple independent parts**, each with its own headers:

```tree
HTTP request
  Part 1 | JSON
  Part 2 | Image
  Part 3 | PDF
  Part 4 | Excel
```

### Example Multipart Request

```text
POST /users
Content-Type: multipart/form-data; boundary=Boundary

------Boundary
Content-Disposition: form-data; name="user"
Content-Type: application/json

{"name":"Rahul","age":25}
------Boundary
Content-Disposition: form-data; name="photo"; filename="profile.jpg"
Content-Type: image/jpeg

(binary image)
------Boundary--
```

Notice that **one part is JSON and another part is a file**.

### Complete Request Flow

```flow
Browser / Postman — multipart/form-data
Tomcat
DispatcherServlet
MultipartResolver parses the parts
@RequestPart / MultipartFile
Controller
Service
Storage
```

## What is MultipartFile?

`MultipartFile` represents an **uploaded file**.

```java
@PostMapping("/upload")
public String upload(@RequestParam MultipartFile file) {
    return file.getOriginalFilename();
}
```

Spring creates a `MultipartFile` object for the uploaded file.

### Important Methods

```java
String getName();
String getOriginalFilename();
String getContentType();
boolean isEmpty();
long getSize();
byte[] getBytes();
InputStream getInputStream();
void transferTo(File destination);
```

An interview favourite.

## Upload a Single File

```java
@PostMapping("/upload")
public String upload(@RequestParam MultipartFile file) {
    System.out.println(file.getOriginalFilename());
    System.out.println(file.getSize());
    return "Uploaded";
}
```

### Saving the File

```java
@PostMapping("/upload")
public String upload(@RequestParam MultipartFile file) throws IOException {

    File destination = new File("C:/uploads/" + file.getOriginalFilename());
    file.transferTo(destination);

    return "Saved";
}
```

`transferTo()` copies the uploaded content to the destination.

> [!WARNING]
> Building the path from `getOriginalFilename()` is unsafe in real code — a name like `../../app.jar` can escape the upload folder (path traversal) or overwrite files. Generate your own name (e.g. a UUID) — see the security checklist below.

## Upload Multiple Files

```java
@PostMapping("/upload")
public String upload(@RequestParam MultipartFile[] files) {
}

// or
@PostMapping("/upload")
public String upload(@RequestParam List<MultipartFile> files) {
}
```

Spring binds all uploaded files.

## Upload JSON + File

A favourite interview question.

```java
public class UserRequest {
    private String name;
    private Integer age;
}

@PostMapping("/users")
public ResponseEntity<String> save(@RequestPart UserRequest user,
                                   @RequestPart MultipartFile photo) {
    return ResponseEntity.ok("Saved");
}
```

The request has **Part 1: user JSON** and **Part 2: photo**. Spring deserializes the JSON into `UserRequest` and creates the `MultipartFile`.

> [!TIP]
> The client must send the JSON part with `Content-Type: application/json` (in Postman, set the part's content type; in JavaScript, append a `Blob` with type `application/json`). Otherwise Spring can't pick the JSON converter and returns `415`.

### Why @RequestPart?

Because every multipart request contains multiple independent parts, and **each part may have a different content type**:

| Part | Content type | Bound to |
| --- | --- | --- |
| 1 | `application/json` | User DTO |
| 2 | `image/png` | `MultipartFile` |
| 3 | `application/pdf` | `MultipartFile` |

`@RequestPart` selects a specific part and, for JSON parts, delegates to an `HttpMessageConverter` (such as Jackson) for deserialization.

## @RequestParam vs @RequestPart vs @ModelAttribute

For a request with simple fields + a file (`name=Rahul`, `photo=file.jpg`):

```java
@RequestParam String name
@RequestParam MultipartFile photo   // works perfectly
```

For **JSON + image**:

```java
@RequestPart UserRequest dto        // the JSON part needs message conversion
@RequestPart MultipartFile photo
```

For an **HTML form** (`name=Rahul`, `age=25`, `photo=file`):

```java
@ModelAttribute UserForm form
@RequestParam MultipartFile photo
```

| Annotation | Best for |
| --- | --- |
| `@RequestBody` | JSON |
| `@ModelAttribute` | Form data |
| `@RequestParam` | Simple fields + files |
| `@RequestPart` | JSON + file |

## File Validation

Always validate uploaded files.

```java
if (file.isEmpty()) {
    throw new RuntimeException("Empty File");
}

if (file.getSize() > 5 * 1024 * 1024) {   // maximum 5 MB
}
```

### Validate the Content Type

Never trust the filename:

```java
String type = file.getContentType();

if (!"image/png".equals(type)) {
}
```

Validate against an **allowlist** of supported types.

### Validate the Extension

```java
String name = file.getOriginalFilename();

if (!name.endsWith(".pdf")) {
}
```

Don't rely only on the extension — check the content type and, for high-security systems, inspect the **file signature (magic bytes)**. (The client controls both the filename and the declared content type.)

## File Upload Security Checklist

- ✅ Limit file size
- ✅ Allow only approved MIME types
- ✅ Sanitize filenames
- ✅ Generate unique filenames
- ✅ Scan uploads for malware if required
- ✅ Store files outside the web root
- ✅ Restrict download authorization

Never trust client-provided filenames or content types alone.

## Streaming Large Files

```java
byte[] data = file.getBytes();                 // ❌ loads the whole file into memory

InputStream stream = file.getInputStream();    // ✅ stream it to storage
```

For very large files, `getBytes()` can consume significant memory. Stream the data to storage when possible.

## Download a File

```java
@GetMapping("/download")
public ResponseEntity<Resource> download() {
}
```

Use the appropriate `Content-Type` and `Content-Disposition` headers so the browser downloads the PDF.

## Multipart Configuration

```text
spring.servlet.multipart.max-file-size=10MB
spring.servlet.multipart.max-request-size=20MB
```

These limit the maximum size of one uploaded file and of the whole request. The defaults are **1MB** per file and **10MB** per request; exceeding them throws `MaxUploadSizeExceededException`.

## Internal Spring Components

Important classes: `MultipartResolver`, `StandardServletMultipartResolver`, `MultipartHttpServletRequest` and `MultipartFile`. Spring Boot uses **`StandardServletMultipartResolver`** by default (built on the Servlet container's own multipart parsing).

```flow
Browser — multipart/form-data
Tomcat
DispatcherServlet
StandardServletMultipartResolver
MultipartHttpServletRequest
RequestPartMethodArgumentResolver
JSON part → HttpMessageConverter → UserRequest
File part → MultipartFile
Controller
```

## Enterprise Architecture

```flow
React — upload image (multipart/form-data)
API gateway
Spring Boot
MultipartResolver
Controller
Service
AWS S3 / Azure Blob / local storage
Database stores metadata
Success response
```

A common enterprise pattern is to store the file in **object storage** (Amazon S3, Azure Blob Storage) and keep only **metadata** (filename, URL, size, content type, owner) in the database.

## Common Mistakes

- ❌ **`@RequestBody MultipartFile file`** — use `@RequestParam MultipartFile file` or `@RequestPart MultipartFile file`, depending on the request format.
- ❌ **Loading huge files into memory** with `getBytes()` — prefer streaming.
- ❌ **Trusting the original filename** — use a generated unique filename (e.g. a UUID) before storing.
- ❌ **No validation** — always check size, content type, file name and upload authorization.
- ❌ **Saving files inside `src/main/resources`** — use dedicated storage outside the application package, or an object storage service.

## Interview Questions

### Q1. What is MultipartFile?

A Spring interface representing an uploaded file in a `multipart/form-data` request.

### Q2. What is multipart/form-data?

An HTTP content type that lets multiple independent parts (text fields and files) be sent in a single request.

### Q3. What is the difference between @RequestParam and @RequestPart?

| @RequestParam | @RequestPart |
| --- | --- |
| Simple form fields and files | Individual multipart parts |
| No message conversion for complex JSON | Uses `HttpMessageConverter` for JSON parts |

### Q4. Which Spring class processes multipart requests?

`StandardServletMultipartResolver` (by default in Spring Boot).

### Q5. Which resolver handles @RequestPart?

`RequestPartMethodArgumentResolver`.

### Q6. Can we upload multiple files?

Yes — use `List<MultipartFile>` or `MultipartFile[]`.

### Q7. How do we upload JSON and files together?

Use `@RequestPart UserRequest dto` and `@RequestPart MultipartFile photo` with a `multipart/form-data` request.

### Q8. What should we validate before storing uploaded files?

File size, MIME type, file signature (when appropriate), file name and authorization.

### Q9. Should we store uploaded files in the database?

Usually: small documents or thumbnails are sometimes stored as BLOBs; large files are commonly stored in object storage or the file system, with only metadata in the database.

## Summary

| Part of a multipart request | Binding |
| --- | --- |
| JSON part | `@RequestPart` → `HttpMessageConverter` → Java DTO |
| File part | `MultipartFile` |
| Form fields | `@RequestParam` / `@ModelAttribute` |

## Key Takeaways

- ✅ `multipart/form-data` lets you upload files and structured data in one request.
- ✅ `MultipartFile` represents an uploaded file with APIs for reading and saving it.
- ✅ Use `@RequestParam` for simple form fields and file uploads.
- ✅ Use `@RequestPart` when a multipart request includes JSON that needs message conversion.
- ✅ Validate file size, type, filename and authorization before storing uploads.
- ✅ Stream large files instead of loading them entirely into memory.
- ✅ Store large files in object storage and persist only metadata in the database.
