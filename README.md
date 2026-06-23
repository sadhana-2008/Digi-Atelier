# 🪴 Digi-Atelier (A Digital Habitat)

> "Software is usually a tool. Digi-Atelier is a place."

## 🌌 The Philosophy: A Spatial Autobiography

Modern software assumes we want to organize our lives into sterile folders, neat categories, and endless to-do lists. But human memory doesn't work like that. Memory is spatial. Memory is atmospheric. We attach our thoughts to the environment we were in when we had them—the light coming through the window, the quiet hum of a rainy study room, the messy desk of a creative breakthrough.

Digi-Atelier is an attempt to rebuild that connection in software. It is a 2.5D atmospheric platform where the interface is a personalized room. It is designed to be a digital space that slowly evolves alongside your life, memories, thoughts, and habits over time. It’s not just a productivity dashboard; it is a "spatial autobiography."

## 🛋️ The Room as the Interface

Instead of navigating through menus and tabs, users interact with meaningful objects placed inside their room. Each object is both functional and emotionally symbolic:

* **The Desk:** The anchor of the room, holding active projects and focus tools.
* **The Journal (Book):** For emotional reflection and daily logs.
* **The Plant:** A visual representation of consistency. Instead of anxiety-inducing "streaks," the plant simply grows healthier as you return and reflect.
* **The Window & Lamp:** Real-time atmospheric syncing. The room shifts from bright morning skies to deep, cozy indigo nights, reflecting the passage of time.

Progression here is environmental richness, not a high score. You don't get points. You get a more beautiful and personal space.

## 🏗️ The Habitat Stack (THB) Architecture

While the frontend focuses entirely on a cozy, lo-fi aesthetic, the underlying architecture is a robust, modern full-stack web application designed for absolute local data privacy and fluid UI transitions.

* **Frontend (The Room):** React, Vite, Tailwind CSS, and Framer Motion. Built using pure SVG and CSS transform math to create a genuine 1-point perspective 2.5D environment without the heavy overhead of a 3D physics engine.
* **Backend (The Brain):** FastAPI (Python) for lightning-fast, asynchronous REST endpoints.
* **Database (The Memory):** SQLite (`database.db`). Serverless local storage ensures the user's spatial memory and journal entries remain completely private and offline.

## 🚀 Development Roadmap

We are currently building the foundation. The philosophy is: "Pretty skies are dessert. Saving data is vegetables." We are laying the concrete before we paint the walls.

### 🧱 V1: The Foundation (Current)

- [x] Phase 1: Core Room Geometry & Perspective Grid lines.
- [x] Phase 2: The Table (2.5D Orthographic perspective, ambient shadows, and drag-and-drop grounding).
- [ ] Phase 3: Ambient Atmospheric Toggle (Lamp Day/Night cycle triggers).
- [ ] Phase 4: FastAPI Backend & SQLite Database Initialization.
- [ ] Phase 5: The Journal Modal & Plant Growth Logic.

### ✨ V2 & Beyond: The Digital Habitat

* **Rabbit Hole System:** Turning internet discoveries and bookmarks into spatial objects within the room.
* **Seasonal Evolution:** Real-time weather syncing (rainy monsoons, winter snowfalls) that changes the color palette of the room.
* **The Monthly Timelapse:** A visual recap showing how your room—and your mind—has evolved over months of use.
* **Creator Marketplace:** Custom aesthetic packs, cozy soundscapes, and unique furniture sprites.

## 🔒 Copyright & Licensing

All rights reserved. This repository and its entire conceptual design, assets, and source code are the exclusive property of the author. 

By default, this project does not include an open-source license. No one has permission to copy, distribute, modify, or reuse any part of this work for commercial or personal projects. Visitors are strictly limited to viewing the source code for educational and reference purposes only.

Digi-Atelier is the first architectural build of the Digital Habitat vision. Handcrafted with 💖 by Sadhana-2008.
