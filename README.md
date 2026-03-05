# G‑Normies iPhone Web App

A minimal **iPhone-first web application** for exploring the **Normies
10k collection** using swipe navigation and pixel‑accurate rendering.

Built with **Next.js**, **React**, **Tailwind**, and deployed on
**Vercel**.

The app is designed to be installed as a **Home Screen Web App** and
provides a smooth, cinematic swipe experience for browsing Normies.

------------------------------------------------------------------------

# Features

• Pixel-perfect rendering of Normies (40×40 bitmap)\
• Swipe navigation across a **100×100 Normie grid (10,000 tokens)**\
• Cinematic swipe animation\
• Tap to enter **Token View**\
• Interactive **pixel density downsampling**\
• Real-time **scanline glitch effects**\
• PNG export of current Normie\
• Dark / Light mode toggle\
• Full-screen **iPhone PWA experience**\
• Edge‑aware navigation (no wraparound)

------------------------------------------------------------------------

# Data Source

Normies data is fetched from:

https://api.normies.art

Example endpoint:

GET /normie/{id}/pixels

Example:

https://api.normies.art/normie/0/pixels

Response:

1600 character bitmap string representing a **40×40 monochrome grid**

Pixel values:

  Value   Meaning
  ------- ---------------------
  1       Pixel ON (#48494b)
  0       Pixel OFF (#e3e5e4)

If the Normie has been customized, the returned bitmap includes the
**composited transform layer**.

------------------------------------------------------------------------

# Tech Stack

• Next.js 16\
• React 19\
• TypeScript\
• TailwindCSS v4\
• Canvas rendering\
• Pointer Events for gesture input\
• Vercel hosting

------------------------------------------------------------------------

# Installation

Clone the repository:

``` bash
git clone https://github.com/FILTER8/normie-app.git
cd g-normies-app
```

Install dependencies:

``` bash
npm install
```

Run locally:

``` bash
npm run dev
```

Open:

    http://localhost:3000

------------------------------------------------------------------------

# Deploy

Deploy easily using **Vercel**:

``` bash
vercel
```

or push to GitHub and import the repo on Vercel.

------------------------------------------------------------------------

# Usage

1.  Open the site on an **iPhone (Safari)**\
2.  Tap **Share**\
3.  Select **Add to Home Screen**\
4.  Launch the app from your Home Screen

The app will run **full screen without browser UI**.

------------------------------------------------------------------------

# Controls

Browse Mode

Swipe left/right/up/down → navigate grid\
Tap → enter Token View

Token View

Top drag → pixel density control\
Bottom drag → glitch intensity control\
Tap → exit Token View

Buttons

Top right → Download PNG\
Bottom right → Toggle dark mode

------------------------------------------------------------------------

# Related

Generate your own G‑Normie:

https://glitch-normies.vercel.app/

Creator:

https://x.com/0xfilter8

------------------------------------------------------------------------

# License

CC0
