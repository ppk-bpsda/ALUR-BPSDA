"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="id">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 24 }}>
        <h2>Aplikasi mengalami kendala</h2>
        <p>Silakan muat ulang halaman. Jika berulang, hubungi administrator sistem.</p>
        <button onClick={() => reset()}>Coba lagi</button>
      </body>
    </html>
  );
}
