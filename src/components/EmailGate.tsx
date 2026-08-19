import { useState, type FormEvent } from "react";
import "./email-gate.css";

interface EmailGateProps {
  assetId: string;
  title: string;
  description: string;
}

export default function EmailGate({ assetId, title, description }: EmailGateProps) {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState(""); // honeypot
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [sent, setSent] = useState(false);
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

      setSent(true);
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (sent) {
    return (
      <div className="gate gate-result">
        <p className="gate-result-note">Please check your inbox for the link.</p>
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
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="gate-input"
        />
        <button type="submit" disabled={status === "loading"} className="gate-button">
          {status === "loading" ? "Sending..." : "Send me the link"}
        </button>
      </form>

      {status === "error" && <p className="gate-error">{errorMessage}</p>}
    </div>
  );
}
