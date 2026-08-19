import { useState, type FormEvent } from "react";
import "./email-gate.css";

type AssetType = "github" | "zip" | "pdf" | "ppt" | "link";

interface EmailGateProps {
  assetId: string;
  title: string;
  description: string;
  assetType: AssetType;
}

interface UnlockResult {
  url: string;
  type: AssetType;
  title: string;
}

const ACTION_LABEL: Record<AssetType, string> = {
  github: "View on GitHub",
  zip: "Download ZIP",
  pdf: "Download PDF",
  ppt: "Download slides",
  link: "Open link",
};

export default function EmailGate({ assetId, title, description, assetType }: EmailGateProps) {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState(""); // honeypot
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [result, setResult] = useState<UnlockResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, assetId, company }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Something went wrong");
      }

      const data: UnlockResult = await res.json();
      setResult(data);
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (result) {
    return (
      <div className="gate gate-result">
        <p className="gate-result-note">Thanks! Your download is ready.</p>
        <a href={result.url} target="_blank" rel="noopener noreferrer" className="gate-result-link">
          {ACTION_LABEL[result.type]}
        </a>
      </div>
    );
  }

  return (
    <div className="gate">
      <p className="gate-title">{title}</p>
      <p className="gate-desc">{description}</p>

      <form onSubmit={handleSubmit} className="gate-form">
        <input
          type="text"
          name="company"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          className="gate-hidden"
          aria-hidden="true"
        />
        <input
          type="email"
          required
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="gate-input"
        />
        <button type="submit" disabled={status === "loading"} className="gate-button">
          {status === "loading" ? "Unlocking..." : ACTION_LABEL[assetType]}
        </button>
      </form>

      {status === "error" && <p className="gate-error">{errorMessage}</p>}
    </div>
  );
}
