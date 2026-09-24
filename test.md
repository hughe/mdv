# Markdown Viewer Test

This is a **test** of the `mdv` viewer with _GitHub-flavored_ markdown.

## GFM Features

- [x] Task list item (checked)
- [ ] Task list item (unchecked)
- Tables and code fences

| Feature | Supported |
| ------- | --------- |
| GFM tables | ✅ |
| Strikethrough | ~~yes~~ |
| Autolinks | https://example.com |

## Code Block

```ts
const greeting: string = "Hello, world!";
console.log(greeting);
```

## Mermaid Diagram

```mermaid
graph TD
    A[User runs mdv] --> B{File exists?}
    B -- yes --> C[Start web server]
    B -- no --> D[Show error]
    C --> E[Open browser]
    E --> F[Rendered page]
```

## Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant CLI as mdv CLI
    participant Server
    User->>CLI: mdv README.md
    CLI->>Server: listen on localhost
    Server-->>CLI: ready
    CLI->>User: open browser
```

> A blockquote, for good measure.

1. First
2. Second
3. Third