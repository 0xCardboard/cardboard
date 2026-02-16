"use client";

import { useState } from "react";

export default function TestPage() {
  const [count, setCount] = useState(0);

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Hydration Test</h1>
      <p>Count: {count}</p>
      <button onClick={() => setCount(c => c + 1)} style={{ padding: "0.5rem 1rem", cursor: "pointer" }}>
        Click me
      </button>
    </div>
  );
}
