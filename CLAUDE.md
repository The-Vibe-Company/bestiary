## 🎮 Project

**Bestiary** is a browser-based strategy game inspired by titles such as **Ikariam**, **OGame**, and similar long-term web games.

The game focuses on:
- long-term progression
- strategic and incremental gameplay
- clarity, stability, and consistency
- a strong emphasis on UI/UX and overall visual coherence

Any code or feature added to the project must respect these principles.

---

## 🧭 Golden Rule

- **Never break the global visual and UX consistency of the website.** When in doubt, choose the simplest, most readable solution that matches the existing design.

---

## 🎨 Design & UX

### Visual consistency
- Always respect:
  - the existing color palette
  - the existing typography
  - spacing, layout, and visual rhythm
- Do not introduce new styles without a clear and explicit reason.
- Reuse existing components whenever possible.

### Buttons & interactions
- **All buttons must clearly look clickable**
  - default state
  - hover state
  - active state
  - disabled state when relevant
- No interactive element should look like static text.
- Clickable areas must be comfortable and accessible.

### User feedback
- Any meaningful action must provide clear feedback:
  - visual (loading state, active state, subtle animations)
  - or textual (message, tooltip, confirmation)
- Avoid silent actions.

---

## 🧱 Code & architecture

- Prioritize:
  - readability
  - simplicity
  - maintainability
- Avoid over-engineering.
- Code should remain understandable **months later without context**.

Before introducing an abstraction, always ask:
> “Is this truly necessary for Bestiary right now?”

---

## 🧪 Testing & verification

### Manual testing
- Use **agent-browser** ONLY IF RELEVANT to:
  - test pages in localhost
  - verify UI interactions
  - ensure buttons are actually clickable
  - detect visual or UX inconsistencies

  Here are the credentials to login : 
    email: test@test.com
    password: testing123

Testing must be done in a real browser, not only by reasoning about the code.

---

## 📚 Documentation & dependencies

- For any API, library, or framework:
  - use **Context7 MCP** to consult the official documentation
  - never guess an API
  - never invent options or parameters

If documentation is unclear:
> ask explicitly before implementing.

---

## 🔐 Security & credentials

- Never:
  - hardcode credentials
  - expose API keys client-side
- All sensitive information must be handled via:
  - environment variables
  - or an equivalent secure mechanism

If access to an external service is required (API, third-party tool):
> explicitly ask for the required credentials before proceeding.

---

## 🧠 Product philosophy

Bestiary is a game:
- designed to be played over the long term
- meant to stay enjoyable even through repetition
- where clarity always beats spectacle

Always prioritize:
- player understanding
- fluid interactions
- consistency across the product

If a feature is “cool” but hurts clarity or coherence:
> it is probably a bad idea.

---

## ❓ When in doubt

- Ask questions rather than assume.
- When relevant, propose multiple options with:
  - pros
  - cons
  - a clear recommendation.
