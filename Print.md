# 📚 HTML Fundamentals - Complete Theory Guide

## Frontend Development Mastery Program

### Module 1: HTML Fundamentals (Topics 1-3)

**Student:** VadymMak  
**Project:** Smart Cline - AI Coding Assistant VS Code Extension  
**Created:** 2025

---

# 📖 Table of Contents

1. [Topic 1: HTML Meaning & Structure](#topic-1-html-meaning--structure)
2. [Topic 2: DOCTYPE Deep Dive](#topic-2-doctype-deep-dive)
3. [Topic 3: Attributes](#topic-3-attributes-alt-title-data-)
4. [Cheat Sheets](#-cheat-sheets)
5. [Interview Questions & Answers](#-interview-questions--answers)
6. [Common Mistakes to Avoid](#-common-mistakes-to-avoid)

---

# Topic 1: HTML Meaning & Structure

## What is HTML?

**HTML** stands for **H**yper**T**ext **M**arkup **L**anguage

| Word         | Meaning                                                   |
| ------------ | --------------------------------------------------------- |
| **Hyper**    | Beyond, more than — links that go beyond single documents |
| **Text**     | The content is text-based (human readable)                |
| **Markup**   | We "mark up" content with tags to give it meaning         |
| **Language** | A standardized way to communicate with browsers           |

### Key Concept: HTML is NOT a Programming Language

HTML is a **markup language** — it describes the **structure** and **meaning** of content, not logic or behavior.

```
Programming Language (JavaScript):
if (user.isLoggedIn) {
  showDashboard();
}

Markup Language (HTML):
<article>
  <h1>Welcome back!</h1>
  <p>Here's your dashboard.</p>
</article>
```

---

## Basic HTML Document Structure

Every HTML document has this skeleton:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Page Title</title>
  </head>
  <body>
    <!-- Your content goes here -->
  </body>
</html>
```

### Breaking Down Each Part

| Element                  | Purpose                                     |
| ------------------------ | ------------------------------------------- |
| `<!DOCTYPE html>`        | Tells browser "this is HTML5"               |
| `<html lang="en">`       | Root element, language declaration          |
| `<head>`                 | Metadata (not visible on page)              |
| `<meta charset="UTF-8">` | Character encoding (supports all languages) |
| `<meta name="viewport">` | Mobile responsiveness                       |
| `<title>`                | Browser tab title, SEO important            |
| `<body>`                 | All visible content                         |

---

## HTML Element Anatomy

```html
<tagname attribute="value">Content</tagname> ↑ ↑ ↑ ↑ ↑ | | | | └── Closing tag |
| | └── What user sees | | └── Attribute value | └── Additional info └── Tag
name (element type)
```

---

## Two Types of Elements

### 1. Container Elements (have opening and closing tags)

```html
<p>This is a paragraph.</p>
<div>This is a container.</div>
<h1>This is a heading.</h1>
```

### 2. Self-closing (Void) Elements (no closing tag needed)

```html
<img src="photo.jpg" alt="A photo" />
<br />
<input type="text" />
<meta charset="UTF-8" />
```

---

## Document Structure Hierarchy

```
📄 HTML Document
│
├── <!DOCTYPE html>          ← Declaration (standards mode)
│
└── <html lang="en">         ← Root element
    │
    ├── <head>               ← Metadata (invisible)
    │   ├── <meta charset>   ← Character encoding
    │   ├── <meta viewport>  ← Mobile responsiveness
    │   ├── <meta description> ← SEO
    │   ├── <title>          ← Browser tab & SEO
    │   ├── <link>           ← CSS files
    │   └── <script>         ← JS files
    │
    └── <body>               ← Content (visible)
        ├── <header>         ← Page/section header
        ├── <nav>            ← Navigation
        ├── <main>           ← Main content (only one!)
        │   ├── <section>    ← Thematic grouping
        │   └── <article>    ← Independent content
        ├── <aside>          ← Sidebar content
        └── <footer>         ← Page/section footer
```

---

## Direct Children vs Descendants

| Term             | Meaning                               |
| ---------------- | ------------------------------------- |
| **Direct child** | Immediately inside parent (one level) |
| **Descendant**   | Anywhere inside parent (any depth)    |

```html
<body>
  <header>
    <!-- Direct child of body -->
    <h1>Title</h1>
    <!-- NOT direct child of body (descendant only) -->
    <p>Text</p>
    <!-- NOT direct child of body (descendant only) -->
  </header>
</body>
```

This matters in CSS selectors:

```css
body > header {
} /* Direct child only */
body header {
} /* Any descendant */
```

---

# Topic 2: DOCTYPE Deep Dive

## What is DOCTYPE?

**DOCTYPE** (Document Type Declaration) is an instruction to the browser:

> "Hey browser, this document is written in HTML5. Please render it using modern standards!"

```html
<!DOCTYPE html>
```

---

## Browser Rendering Modes

Browsers have **three** rendering modes:

### 1️⃣ QUIRKS MODE

- No DOCTYPE or very old DOCTYPE
- Emulates bugs from IE5/Netscape 4
- Box model: width includes padding/border

### 2️⃣ ALMOST STANDARDS MODE (Limited Quirks)

- Triggered by old "Transitional" DOCTYPEs
- Like standards mode, but with table cell quirks
- Images in table cells handled differently

### 3️⃣ STANDARDS MODE (No Quirks)

- `<!DOCTYPE html>` triggers this
- Full W3C specification compliance
- Consistent across all modern browsers

---

## How to Check Current Mode

```javascript
// In browser console (F12 → Console)
document.compatMode;

// Returns:
// "BackCompat" → Quirks Mode 😱
// "CSS1Compat" → Standards Mode ✅
```

---

## Box Model Difference Example

```css
.box {
  width: 100px;
  padding: 20px;
  border: 5px solid black;
}
```

| Mode               | Total Width | Calculation                   |
| ------------------ | ----------- | ----------------------------- |
| **Standards Mode** | 150px       | 100 + 20 + 20 + 5 + 5         |
| **Quirks Mode**    | 100px       | padding & border inside width |

Same CSS → Different results!

---

## DOCTYPE History

### Old HTML 4.01 (1999)

```html
<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd">
```

### Old XHTML 1.0 (2000)

```html
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
```

### Modern HTML5 (2014+)

```html
<!DOCTYPE html>
```

---

## What is DTD?

**DTD** = Document Type Definition

A set of rules that defines:

- Which elements are allowed in the document
- Which attributes each element can have
- How elements can be nested
- What structure is valid

**Why no DTD in HTML5?**

1. Browsers never actually downloaded DTD files
2. Validation happens differently now
3. HTML5 is not based on SGML/XML
4. Simpler is better!

---

## HTML Validation Tools

| Tool                   | URL                      | Use Case                |
| ---------------------- | ------------------------ | ----------------------- |
| **W3C Validator**      | validator.w3.org         | Official, most thorough |
| **Nu Html Checker**    | validator.w3.org/nu      | Modern, HTML5 focused   |
| **Browser DevTools**   | F12 → Elements           | Quick local check       |
| **VS Code Extensions** | HTMLHint, W3C Validation | Real-time in editor     |

---

# Topic 3: Attributes (alt, title, data-\*)

## What are HTML Attributes?

Attributes provide **additional information** about elements:

```html
<element attribute="value">Content</element> ↑ ↑ name value
```

---

## 1️⃣ Global Attributes (work on ANY element)

| Attribute  | Purpose           | Example                               |
| ---------- | ----------------- | ------------------------------------- |
| `id`       | Unique identifier | `<div id="header">`                   |
| `class`    | CSS class(es)     | `<p class="intro highlight">`         |
| `style`    | Inline CSS        | `<span style="color: red;">`          |
| `title`    | Tooltip text      | `<abbr title="HyperText">HTML</abbr>` |
| `lang`     | Language          | `<p lang="uk">Привіт</p>`             |
| `hidden`   | Hide element      | `<div hidden>Secret</div>`            |
| `tabindex` | Tab order         | `<button tabindex="1">`               |

---

## 2️⃣ Accessibility Attributes

### The `alt` Attribute (Images)

```html
<!-- ❌ Wrong - no alt -->
<img src="logo.png" />

<!-- ⚠️ Bad - useless alt -->
<img src="logo.png" alt="image" />

<!-- ✅ Good - descriptive alt -->
<img src="logo.png" alt="Smart Cline logo - AI coding assistant" />

<!-- ✅ Decorative image - empty alt -->
<img src="decoration.png" alt="" />
```

### Rules for `alt`

| Image Type               | Alt Text                                  |
| ------------------------ | ----------------------------------------- |
| Informative              | Describe the content                      |
| Functional (button/link) | Describe the action                       |
| Decorative               | Empty: `alt=""`                           |
| Complex (charts)         | Brief summary + longer description nearby |

### The `title` Attribute

```html
<!-- Tooltip on hover -->
<abbr title="Visual Studio Code">VS Code</abbr>

<!-- Link hint -->
<a href="docs.html" title="Read full documentation">Docs</a>
```

### `alt` vs `title` Comparison

| Attribute | Purpose           | Screen Readers    | Required          |
| --------- | ----------------- | ----------------- | ----------------- |
| `alt`     | Image description | ✅ Always read    | Yes (for `<img>`) |
| `title`   | Tooltip/hint      | ⚠️ Sometimes read | No                |

---

## 3️⃣ Custom Data Attributes (data-\*)

Store custom data in HTML for JavaScript:

```html
<!-- Store data on elements -->
<article
  data-post-id="123"
  data-author="VadymMak"
  data-category="tutorial"
  data-published="2025-01-15"
>
  <h2>My Blog Post</h2>
</article>

<!-- Access in JavaScript -->
<script>
  const article = document.querySelector("article");

  console.log(article.dataset.postId); // "123"
  console.log(article.dataset.author); // "VadymMak"
  console.log(article.dataset.category); // "tutorial"
</script>
```

### Naming Rules

| HTML Attribute   | JavaScript Access          |
| ---------------- | -------------------------- |
| `data-id`        | `element.dataset.id`       |
| `data-user-name` | `element.dataset.userName` |
| `data-post-id`   | `element.dataset.postId`   |

**Note:** Hyphens become **camelCase** in JavaScript!

---

## 4️⃣ Boolean Attributes

These don't need a value — presence means `true`:

```html
<!-- Boolean attributes -->
<input type="text" disabled>           <!-- disabled=true -->
<input type="checkbox" checked>        <!-- checked=true -->
<video autoplay muted>                 <!-- both true -->
<details open>                         <!-- open=true -->
<script defer>                         <!-- defer=true -->

<!-- All these are equivalent -->
<input disabled>
<input disabled="">
<input disabled="disabled">
<input disabled="true">
```

---

# 📋 Cheat Sheets

## HTML Document Structure Cheat Sheet

```
┌─────────────────────────────────────────────────────────────┐
│            HTML DOCUMENT STRUCTURE                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  <!DOCTYPE html>              ← Always first line           │
│  <html lang="en">             ← Root + language             │
│    <head>                     ← Invisible metadata          │
│      <meta charset="UTF-8">                                 │
│      <meta name="viewport"                                  │
│            content="width=device-width, initial-scale=1.0"> │
│      <meta name="description" content="...">                │
│      <title>Page Title</title>                              │
│    </head>                                                  │
│    <body>                     ← Visible content             │
│      <header>                                               │
│        <h1>Only one h1!</h1>                                │
│      </header>                                              │
│      <main>                                                 │
│        <section>                                            │
│          <h2>Section heading</h2>                           │
│        </section>                                           │
│      </main>                                                │
│      <footer></footer>                                      │
│    </body>                                                  │
│  </html>                                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## DOCTYPE Cheat Sheet

```
┌─────────────────────────────────────────────────────────────┐
│                   DOCTYPE CHEAT SHEET                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ALWAYS USE:                                                │
│    <!DOCTYPE html>                                          │
│                                                             │
│  PLACEMENT:                                                 │
│    - Very first line (no spaces, no comments before)        │
│    - Before <html> tag                                      │
│                                                             │
│  CHECK MODE:                                                │
│    document.compatMode                                      │
│    → "CSS1Compat" = Standards Mode ✅                       │
│    → "BackCompat" = Quirks Mode ❌                          │
│                                                             │
│  VALIDATE:                                                  │
│    → validator.w3.org/nu                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Attributes Cheat Sheet

```
┌─────────────────────────────────────────────────────────────┐
│                 HTML ATTRIBUTES CHEAT SHEET                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  GLOBAL (any element):                                      │
│    id="unique"     - One per page                           │
│    class="names"   - Multiple allowed, space-separated      │
│    style="css"     - Inline styles (avoid if possible)      │
│    title="hint"    - Tooltip on hover                       │
│    lang="en"       - Content language                       │
│    hidden          - Hide element                           │
│                                                             │
│  ACCESSIBILITY:                                             │
│    alt="text"      - Image description (REQUIRED)           │
│    aria-label=""   - Screen reader label                    │
│    aria-hidden=""  - Hide from screen readers               │
│    role=""         - Element role                           │
│                                                             │
│  CUSTOM DATA:                                               │
│    data-*="value"  - Custom data storage                    │
│    data-user-id    → dataset.userId (JS)                    │
│                                                             │
│  BOOLEAN (no value needed):                                 │
│    disabled, checked, readonly, required,                   │
│    hidden, autoplay, muted, loop, defer, async              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Meta Tags Cheat Sheet

```
┌─────────────────────────────────────────────────────────────┐
│                   META TAGS CHEAT SHEET                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ESSENTIAL:                                                 │
│    <meta charset="UTF-8">                                   │
│    <meta name="viewport"                                    │
│          content="width=device-width, initial-scale=1.0">   │
│                                                             │
│  SEO:                                                       │
│    <meta name="description" content="Page description">     │
│    <meta name="keywords" content="keyword1, keyword2">      │
│    <meta name="author" content="Author Name">               │
│                                                             │
│  SOCIAL MEDIA (Open Graph):                                 │
│    <meta property="og:title" content="Title">               │
│    <meta property="og:description" content="Description">   │
│    <meta property="og:image" content="image-url">           │
│                                                             │
│  TWITTER:                                                   │
│    <meta name="twitter:card" content="summary">             │
│    <meta name="twitter:title" content="Title">              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

# 🎯 Interview Questions & Answers

## Topic 1: HTML Meaning & Structure

### Q: What does HTML stand for and what is it used for?

**Junior Answer:**

> "HTML stands for HyperText Markup Language. It's used to create the structure of web pages. It's not a programming language — it's a markup language that tells browsers what content to display."

**Senior Answer:**

> "HTML is a markup language that defines document structure and semantics. The key insight is that HTML should describe what content is, not how it looks — that separation of concerns is fundamental to web architecture. Semantic HTML improves accessibility for screen readers, helps search engines understand content, and makes code more maintainable."

---

### Q: What is the basic structure of an HTML document?

**Answer:**

> "An HTML document has four essential parts:
>
> 1. **DOCTYPE** declaration — triggers standards mode
> 2. **`<html>`** tag — root element with lang attribute
> 3. **`<head>`** section — metadata (charset, viewport, title, links)
> 4. **`<body>`** section — visible content with semantic elements"

---

## Topic 2: DOCTYPE

### Q: What is DOCTYPE and why is it important?

**Answer:**

> "DOCTYPE is a declaration that tells the browser which HTML version to use. It must be the very first line. For HTML5, it's simply `<!DOCTYPE html>`. Without it, browsers fall back to quirks mode, which causes inconsistent rendering like different box model calculations."

---

### Q: How can you check if a webpage is in Standards Mode?

**Answer:**

> "Use `document.compatMode` in the browser console. It returns 'CSS1Compat' for Standards Mode or 'BackCompat' for Quirks Mode. You can also validate with validator.w3.org/nu."

---

## Topic 3: Attributes

### Q: What's the difference between `alt` and `title` attributes?

**Answer:**

> "`alt` is required on images for accessibility — screen readers always read it, and it shows if the image fails to load. `title` is optional and creates a tooltip on hover, but screen readers may not announce it. Never rely on `title` alone for accessibility."

---

### Q: What are data attributes and how do you use them?

**Answer:**

> "Data attributes (data-\*) let you store custom data on HTML elements for JavaScript. In HTML, use hyphens like `data-user-id`. In JavaScript, access them through the dataset property with camelCase: `element.dataset.userId`. They're great for storing state without using global variables."

---

# ❌ Common Mistakes to Avoid

## HTML Structure Mistakes

```html
<!-- ❌ Forgetting DOCTYPE -->
<html>
  <!-- ✅ Correct -->
  <!DOCTYPE html>
  <html></html>
</html>
```

```html
<!-- ❌ Missing lang attribute -->
<html>
  <!-- ✅ Correct -->
  <html lang="en"></html>
</html>
```

```html
<!-- ❌ Content in head instead of body -->
<head>
  <p>Hello World</p>
</head>

<!-- ✅ Correct -->
<body>
  <p>Hello World</p>
</body>
```

```html
<!-- ❌ Multiple h1 tags -->
<h1>Title</h1>
<h1>Another Title</h1>

<!-- ✅ Correct - one h1, then h2 -->
<h1>Main Title</h1>
<h2>Section Title</h2>
```

---

## DOCTYPE Mistakes

```html
<!-- ❌ Comment before DOCTYPE -->
<!-- My page -->
<!DOCTYPE html>

<!-- ✅ DOCTYPE must be first -->
<!DOCTYPE html>
<!-- My page -->
```

```html
<!-- ❌ Wrong DOCTYPE syntax -->
<!DOCTYPE html 5>
<!DOCTYP html>

<!-- ✅ Correct -->
<!DOCTYPE html>
```

---

## Attribute Mistakes

```html
<!-- ❌ Missing alt on images -->
<img src="photo.jpg" />

<!-- ✅ Always include alt -->
<img src="photo.jpg" alt="Description" />
```

```html
<!-- ❌ Duplicate IDs -->
<div id="card">Card 1</div>
<div id="card">Card 2</div>

<!-- ✅ Use class for multiple elements -->
<div class="card">Card 1</div>
<div class="card">Card 2</div>
```

```html
<!-- ❌ Wrong data attribute naming -->
<div data-userId="123">
  <!-- ✅ Use hyphens in HTML -->
  <div data-user-id="123"></div>
</div>
```

```html
<!-- ❌ Wrong boolean attribute -->
<input disabled="false" />
<!-- Still disabled! -->

<!-- ✅ Remove attribute to enable -->
<input />
<!-- Enabled -->
<input disabled />
<!-- Disabled -->
```

---

# 💡 Smart Cline Application Examples

## Webview HTML Structure

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Smart Cline</title>
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>
```

## Chat Message with Data Attributes

```html
<div
  class="message"
  data-message-id="msg-456"
  data-model="claude-3"
  data-timestamp="2025-01-15T10:30:00"
  data-role="assistant"
>
  <p>Here's the code you requested...</p>
</div>

<script>
  const messages = document.querySelectorAll(".message");
  messages.forEach((msg) => {
    console.log(msg.dataset.model); // "claude-3"
    console.log(msg.dataset.role); // "assistant"
  });
</script>
```

---

# 📊 Progress Tracker

| Topic                             | Status         | Score |
| --------------------------------- | -------------- | ----- |
| Topic 1: HTML Meaning & Structure | ✅ Complete    | 84%   |
| Topic 2: DOCTYPE Deep Dive        | ✅ Complete    | 94%   |
| Topic 3: Attributes               | 🔄 In Progress | -     |
| Topic 4: Semantic HTML            | ⏳ Pending     | -     |
| Topic 5: Tags Comparison          | ⏳ Pending     | -     |
| Topic 6: Responsive Images        | ⏳ Pending     | -     |
| Topic 7: Viewport & Mobile-first  | ⏳ Pending     | -     |

---

_Document created for VadymMak's Frontend Development Mastery Program_  
_Module 1: HTML Fundamentals_
