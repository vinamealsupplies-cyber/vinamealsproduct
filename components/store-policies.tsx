"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, FileText, Search, X } from "lucide-react";
import {
  POLICY_EFFECTIVE_DATE,
  POLICY_STORE,
  policySearchText,
  storePolicies,
  type PolicySection
} from "@/lib/data/store-policies";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Highlight search matches inside plain text (safe — no HTML injection). */
function HighlightText({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;

  const pattern = new RegExp(`(${escapeRegExp(q)})`, "ig");
  const parts = text.split(pattern);
  if (parts.length === 1) return <>{text}</>;

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark key={`${index}-${part}`} className="policy-mark">
            {part}
          </mark>
        ) : (
          <span key={`${index}-${part}`}>{part}</span>
        )
      )}
    </>
  );
}

function PolicyBody({ section, query }: { section: PolicySection; query: string }) {
  return (
    <div className="policy-body">
      {section.paragraphs.map((paragraph, index) => (
        <p key={index}>
          <HighlightText text={paragraph} query={query} />
        </p>
      ))}

      {section.bullets?.length ? (
        <ul>
          {section.bullets.map((item) => (
            <li key={item}>
              <HighlightText text={item} query={query} />
            </li>
          ))}
        </ul>
      ) : null}

      {section.groups?.map((group) => (
        <div className="policy-group" key={group.heading}>
          <h3>
            <HighlightText text={group.heading} query={query} />
          </h3>
          <ul>
            {group.bullets.map((item) => (
              <li key={item}>
                <HighlightText text={item} query={query} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function StorePolicies() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return storePolicies;
    return storePolicies.filter((section) => policySearchText(section).includes(q));
  }, [query]);

  const matchCount = filtered.length;
  const total = storePolicies.length;

  return (
    <div className="policy-page">
      <header className="page-heading">
        <span className="kicker">Store policies</span>
        <h1>
          <FileText size={28} aria-hidden="true" /> Shipping, returns, privacy, and terms
        </h1>
        <p>
          Customer-facing policies for {POLICY_STORE.name} — adapted for a U.S. online store based
          in {POLICY_STORE.city}, with Stripe payments, physical goods (including food products),
          store pickup, and shipping.
        </p>
        <p className="policy-meta">
          Effective date: <strong>{POLICY_EFFECTIVE_DATE}</strong>
          {" · "}
          Support:{" "}
          <a className="text-link" href={`mailto:${POLICY_STORE.email}`}>
            {POLICY_STORE.email}
          </a>
          {" · "}
          <Link className="text-link" href="/contact">
            Contact
          </Link>
        </p>
      </header>

      <div className="setup-notice warning policy-disclaimer" role="note">
        <AlertTriangle size={18} aria-hidden="true" />
        <div>
          <strong>Not legal advice</strong>
          <p>
            These policies are operational templates adapted from a California-focused e-commerce
            policy pack. They must match our actual data collection, vendors, shipping, and refund
            practices. Obtain attorney review before relying on them for compliance—especially for
            food products, payments, advertising tools, and California privacy rules.
          </p>
        </div>
      </div>

      <div className="policy-search-bar" role="search">
        <label className="policy-search-field" htmlFor="policy-search">
          <Search size={18} aria-hidden="true" />
          <input
            id="policy-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search policies (returns, cookies, shipping, CCPA…)"
            autoComplete="off"
            enterKeyHint="search"
          />
          {query ? (
            <button
              type="button"
              className="policy-search-clear"
              onClick={() => setQuery("")}
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          ) : null}
        </label>
        <p className="field-hint" aria-live="polite">
          {query.trim()
            ? matchCount === 0
              ? `No sections match “${query.trim()}”.`
              : `Showing ${matchCount} of ${total} sections matching “${query.trim()}”.`
            : `${total} policy sections — use search or jump from the table of contents.`}
        </p>
      </div>

      {!query.trim() || matchCount > 0 ? (
        <nav className="policy-toc" aria-label="Policy table of contents">
          <h2>Contents</h2>
          <ol>
            {filtered.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>
                  <span className="policy-toc-num">{section.number}</span>
                  <span>
                    <strong>
                      <HighlightText text={section.title} query={query} />
                    </strong>
                    <small>
                      <HighlightText text={section.summary} query={query} />
                    </small>
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      <div className="policy-sections">
        {filtered.map((section) => (
          <article className="policy-section form-card" id={section.id} key={section.id}>
            <header className="form-card-heading">
              <div>
                <p className="policy-section-kicker">Section {section.number}</p>
                <h2>
                  <HighlightText text={section.title} query={query} />
                </h2>
                <p>
                  <HighlightText text={section.summary} query={query} />
                </p>
              </div>
              <a className="text-link policy-top-link" href="#top">
                Back to top
              </a>
            </header>
            <PolicyBody section={section} query={query} />
          </article>
        ))}
      </div>

      {query.trim() && matchCount === 0 ? (
        <div className="empty-state">
          <Search size={32} />
          <h2>No matching policy text</h2>
          <p>Try another keyword such as “refund”, “cookie”, “pickup”, or “privacy”.</p>
          <button className="button secondary" type="button" onClick={() => setQuery("")}>
            Clear search
          </button>
        </div>
      ) : null}
    </div>
  );
}
