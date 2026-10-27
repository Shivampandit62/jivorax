/*
 * Jivora — tool registry.
 * Single source of truth used by global search, the hero search box
 * and the tools directory page. Static HTML mirrors this data for SEO.
 */

/* ---- Shared line-style icons (inline SVG, currentColor) ---- */
var JIVORA_ICONS = {
  percent: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="7" cy="7" r="2.6"/><circle cx="17" cy="17" r="2.6"/><path d="M19 5 5 19"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
  cap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 8.5 12 4l10 4.5-10 4.5L2 8.5Z"/><path d="M6 10.8V16c0 1.6 2.7 3 6 3s6-1.4 6-3v-5.2"/><path d="M21.5 9v5"/></svg>',
  bank: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10 12 4l9 6"/><path d="M5.5 10.5V18M9.8 10.5V18M14.2 10.5V18M18.5 10.5V18"/><path d="M3 21h18"/></svg>',
  receipt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9.5 8.5h5M9.5 12.5h5"/></svg>',
  qr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h6v6H4z"/><path d="M14 4h6v6h-6z"/><path d="M4 14h6v6H4z"/><path d="M14 14h2.6v2.6H14z"/><path d="M18.4 18.4h2.6v2.6h-2.6z"/><path d="M20 14h1M14 20h1"/></svg>',
  text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16M4 10h16M4 15h10M4 20h7"/></svg>',
  json: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.5 4c-2 0-3 1.1-3 3v1.8c0 1.4-1 2.4-2.5 3.2 1.5.8 2.5 1.8 2.5 3.2V17c0 1.9 1 3 3 3"/><path d="M14.5 4c2 0 3 1.1 3 3v1.8c0 1.4 1 2.4 2.5 3.2-1.5.8-2.5 1.8-2.5 3.2V17c0 1.9-1 3-3 3"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="10" width="15" height="10.5" rx="3"/><path d="M8 10V7.2a4 4 0 0 1 8 0V10"/><circle cx="12" cy="15.2" r="1.4"/></svg>',
  compress: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/><rect x="9" y="9" width="6" height="6" rx="1.2"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5v13Z"/><path d="M20 17v3H6.5"/><path d="M8.5 8h7M8.5 11.5h5"/></svg>',
  coins: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><ellipse cx="12" cy="6.3" rx="7" ry="2.8"/><path d="M5 6.3v5.2c0 1.6 3.1 2.9 7 2.9s7-1.3 7-2.9V6.3"/><path d="M5 11.5v5.2c0 1.6 3.1 2.9 7 2.9s7-1.3 7-2.9v-5.2"/></svg>',
  code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.6 5l-3.2 14"/></svg>',
  zap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2.5 4.8 13.4h6.1L10.4 21.5l8.3-11.2h-6.1L13 2.5Z"/></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9.3" r="1.7"/><path d="m4 18.5 5-5 4 4 3-3 4 4"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/></svg>'
};

/* ---- Categories ---- */
var JIVORA_CATEGORIES = [
  { id: "student", name: "Student Tools", icon: "book", blurb: "Calculators and timers that make study life easier." },
  { id: "finance", name: "Finance Tools", icon: "coins", blurb: "Plan loans, taxes and investments in seconds." },
  { id: "developer", name: "Developer Tools", icon: "code", blurb: "Format, encode and generate — right inside your browser." },
  { id: "text", name: "Text Tools", icon: "text", blurb: "Count, clean and transform any text instantly." },
  { id: "image", name: "Image Tools", icon: "image", blurb: "Compress and convert images without uploading them." },
  { id: "everyday", name: "Everyday Tools", icon: "zap", blurb: "Small handy tools you will reach for every day." }
];

/* ---- Tools ----
 * available: true  -> fully working tool with its own page
 * available: false -> listed for the roadmap, not clickable yet
 */
var JIVORA_TOOLS = [
  /* Student */
  { slug: "percentage-calculator", name: "Percentage Calculator", cat: "student", icon: "percent", available: true,
    desc: "Percentage of a number, what percent X is of Y, and percentage increase or decrease.",
    keywords: ["percent", "percentage", "%", "maths", "marks"] },
  { slug: "cgpa-calculator", name: "CGPA Calculator", cat: "student", icon: "cap", available: true,
    desc: "Calculate CGPA from multiple subjects and get an approximate percentage.",
    keywords: ["gpa", "grades", "semester", "marks", "result", "credit"] },
  { slug: "gpa-calculator", name: "GPA Calculator", cat: "student", icon: "cap", available: true,
    desc: "Find your semester GPA from grade points and credit hours.",
    keywords: ["grades", "marks", "semester", "credit"] },
  { slug: "age-calculator", name: "Age Calculator", cat: "student", icon: "calendar", available: true,
    desc: "Find your exact age in years, months and days from any date of birth.",
    keywords: ["birthday", "dob", "date of birth", "how old"] },
  { slug: "study-timer", name: "Study Timer", cat: "student", icon: "zap", available: true,
    desc: "A focused timer that keeps your study sessions on track.",
    keywords: ["focus", "pomodoro", "study", "revision"] },
  { slug: "pomodoro-timer", name: "Pomodoro Timer", cat: "student", icon: "zap", available: true,
    desc: "Classic 25/5 Pomodoro cycles so you study smarter with proper breaks.",
    keywords: ["focus", "break", "timer", "study"] },

  /* Finance */
  { slug: "emi-calculator", name: "EMI Calculator", cat: "finance", icon: "bank", available: true,
    desc: "Estimate monthly EMI, total interest and total payment for any loan.",
    keywords: ["money", "loan", "installment", "borrow", "mortgage", "car loan", "home loan"] },
  { slug: "sip-calculator", name: "SIP Calculator", cat: "finance", icon: "coins", available: true,
    desc: "Project the future value of your monthly SIP investments.",
    keywords: ["money", "invest", "mutual fund", "returns", "wealth"] },
  { slug: "gst-calculator", name: "GST Calculator", cat: "finance", icon: "receipt", available: true,
    desc: "Add or remove GST from any amount with every standard rate.",
    keywords: ["money", "tax", "invoice", "billing", "gst"] },
  { slug: "simple-interest-calculator", name: "Simple Interest Calculator", cat: "finance", icon: "bank", available: true,
    desc: "Work out simple interest and total amount on your principal.",
    keywords: ["interest", "loan", "bank"] },
  { slug: "compound-interest-calculator", name: "Compound Interest Calculator", cat: "finance", icon: "coins", available: true,
    desc: "See how savings grow over time with compound interest.",
    keywords: ["interest", "savings", "invest"] },
  { slug: "discount-calculator", name: "Discount Calculator", cat: "finance", icon: "receipt", available: true,
    desc: "Find the final price and total saved after a discount.",
    keywords: ["sale", "offer", "price", "percent"] },

  /* Developer */
  { slug: "json-formatter", name: "JSON Formatter", cat: "developer", icon: "json", available: true,
    desc: "Beautify, minify and validate JSON with friendly error messages.",
    keywords: ["json", "pretty", "beautify", "minify", "format", "validate"] },
  { slug: "json-validator", name: "JSON Validator", cat: "developer", icon: "json", available: true,
    desc: "Check JSON for syntax errors and see exactly where the problem is.",
    keywords: ["json", "validate", "error", "lint"] },
  { slug: "base64-encoder", name: "Base64 Encoder", cat: "developer", icon: "code", available: true,
    desc: "Encode any text to a Base64 string instantly.",
    keywords: ["base64", "encode", "string"] },
  { slug: "base64-decoder", name: "Base64 Decoder", cat: "developer", icon: "code", available: true,
    desc: "Decode Base64 strings back into readable text.",
    keywords: ["base64", "decode"] },
  { slug: "uuid-generator", name: "UUID Generator", cat: "developer", icon: "code", available: true,
    desc: "Generate random UUID v4 identifiers in one click.",
    keywords: ["uuid", "guid", "random", "identifier"] },
  { slug: "regex-tester", name: "Regex Tester", cat: "developer", icon: "code", available: true,
    desc: "Test regular expressions against sample text with live matches.",
    keywords: ["regex", "regexp", "pattern", "match"] },
  { slug: "html-formatter", name: "HTML Formatter", cat: "developer", icon: "code", available: true,
    desc: "Prettify messy HTML markup so it is easy to read.",
    keywords: ["html", "format", "prettify", "markup"] },

  /* Text */
  { slug: "word-counter", name: "Word Counter", cat: "text", icon: "text", available: true,
    desc: "Count words, characters, sentences and paragraphs as you type.",
    keywords: ["text", "words", "essay", "typing", "reading time"] },
  { slug: "character-counter", name: "Character Counter", cat: "text", icon: "text", available: true,
    desc: "Count characters with and without spaces in real time.",
    keywords: ["text", "chars", "limit", "length"] },
  { slug: "case-converter", name: "Case Converter", cat: "text", icon: "text", available: true,
    desc: "Switch text between UPPERCASE, lowercase, Title Case and more.",
    keywords: ["text", "uppercase", "lowercase", "title case", "capital"] },
  { slug: "text-cleaner", name: "Text Cleaner", cat: "text", icon: "text", available: true,
    desc: "Remove extra spaces, smart quotes and messy formatting.",
    keywords: ["clean", "spaces", "format", "tidy"] },
  { slug: "duplicate-line-remover", name: "Duplicate Line Remover", cat: "text", icon: "text", available: true,
    desc: "Paste a list and remove duplicate lines in one click.",
    keywords: ["dedupe", "lines", "unique", "list"] },
  { slug: "text-reverser", name: "Text Reverser", cat: "text", icon: "text", available: true,
    desc: "Reverse text, words or entire paragraphs instantly.",
    keywords: ["reverse", "backwards"] },

  /* Image */
  { slug: "image-compressor", name: "Image Compressor", cat: "image", icon: "compress", available: true,
    desc: "Shrink JPG, PNG and WebP images in your browser — nothing is uploaded.",
    keywords: ["compress", "photo", "optimize", "jpg", "png", "reduce size", "smaller"] },
  { slug: "image-resizer", name: "Image Resizer", cat: "image", icon: "image", available: true,
    desc: "Resize images to exact dimensions without a visible quality drop.",
    keywords: ["resize", "dimensions", "scale"] },
  { slug: "jpg-to-png", name: "JPG to PNG", cat: "image", icon: "image", available: true,
    desc: "Convert JPG images to PNG in one click.",
    keywords: ["convert", "jpg", "png"] },
  { slug: "png-to-jpg", name: "PNG to JPG", cat: "image", icon: "image", available: true,
    desc: "Convert PNG images into lightweight JPG files.",
    keywords: ["convert", "png", "jpg"] },
  { slug: "image-cropper", name: "Image Cropper", cat: "image", icon: "image", available: true,
    desc: "Crop images to the perfect size for any platform.",
    keywords: ["crop", "cut", "social"] },
  { slug: "image-to-pdf", name: "Image to PDF", cat: "image", icon: "image", available: true,
    desc: "Turn one or more images into a single PDF document.",
    keywords: ["pdf", "convert", "document"] },

  /* Everyday */
  { slug: "qr-code-generator", name: "QR Code Generator", cat: "everyday", icon: "qr", available: true,
    desc: "Create QR codes for text, links, phone numbers and emails.",
    keywords: ["qr", "qrcode", "scan", "link", "url"] },
  { slug: "password-generator", name: "Password Generator", cat: "everyday", icon: "lock", available: true,
    desc: "Create strong random passwords with instant strength scoring.",
    keywords: ["password", "secure", "random", "strong", "generator", "privacy"] },
  { slug: "random-number-generator", name: "Random Number Generator", cat: "everyday", icon: "zap", available: true,
    desc: "Pick a random number within any range.",
    keywords: ["random", "number", "dice", "range"] },
  { slug: "random-name-picker", name: "Random Name Picker", cat: "everyday", icon: "grid", available: true,
    desc: "Pick a random name from a list — perfect for teams and classrooms.",
    keywords: ["random", "name", "picker", "winner", "raffle"] },
  { slug: "stopwatch", name: "Stopwatch", cat: "everyday", icon: "zap", available: true,
    desc: "A precise stopwatch with lap times.",
    keywords: ["timer", "clock", "lap", "time"] },
  { slug: "countdown-timer", name: "Countdown Timer", cat: "everyday", icon: "zap", available: true,
    desc: "Set a countdown for anything and know exactly when time is up.",
    keywords: ["timer", "countdown", "alarm"] }
];

/* ---- Popular tools shown on the home page (all fully working) ---- */
var JIVORA_POPULAR_SLUGS = [
  "percentage-calculator",
  "qr-code-generator",
  "age-calculator",
  "emi-calculator",
  "word-counter",
  "password-generator"
];
