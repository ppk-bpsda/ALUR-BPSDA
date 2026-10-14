"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { User, Lock, Eye, EyeOff, CalendarRange, Layers, ArrowRight, Loader2 } from "lucide-react";
import { login } from "./actions";

type Opt = { value: string | number; label: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-80 disabled:cursor-wait transition-all text-white text-sm font-medium rounded-xl py-3 flex items-center justify-center gap-2 shadow-lg shadow-brand-900/10 active:scale-[0.99]"
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> Memeriksa akun…
        </>
      ) : (
        <>
          Masuk <ArrowRight className="h-4 w-4" />
        </>
      )}
    </button>
  );
}

const box =
  "flex items-center gap-2.5 border border-slate-200 bg-white rounded-xl px-3.5 py-2.5 transition-all focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100";

export default function LoginForm({ tahunOptions, tahapanOptions }: { tahunOptions: Opt[]; tahapanOptions: Opt[] }) {
  const [show, setShow] = useState(false);
  return (
    <form action={login} className="space-y-4">
      <div>
        <label className="field-label">Username</label>
        <div className={box}>
          <User className="h-4 w-4 text-slate-400" />
          <input
            name="username"
            type="text"
            required
            autoFocus
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            className="w-full text-sm outline-none bg-transparent placeholder:text-slate-400"
            placeholder="mis. admin1"
          />
        </div>
      </div>

      <div>
        <label className="field-label">Kata Sandi</label>
        <div className={box}>
          <Lock className="h-4 w-4 text-slate-400" />
          <input
            name="password"
            type={show ? "text" : "password"}
            required
            autoComplete="current-password"
            className="w-full text-sm outline-none bg-transparent placeholder:text-slate-400"
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="text-slate-400 hover:text-slate-600"
            aria-label={show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label">Tahun Anggaran</label>
          <div className={box}>
            <CalendarRange className="h-4 w-4 text-slate-400 shrink-0" />
            <select name="tahun_anggaran" required defaultValue={tahunOptions[0]?.value} className="w-full text-sm outline-none bg-transparent">
              {tahunOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="field-label">Tahapan</label>
          <div className={box}>
            <Layers className="h-4 w-4 text-slate-400 shrink-0" />
            <select name="tahapan" required defaultValue="murni" className="w-full text-sm outline-none bg-transparent">
              {tahapanOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="pt-2">
        <SubmitButton />
      </div>
    </form>
  );
}
