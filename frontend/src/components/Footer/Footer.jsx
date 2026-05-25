import './Footer.css';

/**
 * Minimal app footer with version, links, and credit.
 */
export default function Footer() {
  return (
    <footer className="app-footer" role="contentinfo">
      <span className="footer-copy">
        © {new Date().getFullYear()} Autocorrect Tool · v1.0.0
      </span>
      <nav className="footer-links" aria-label="Footer links">
        <a
          href="https://github.com/mimanshugahlaut/autocorrect_tool"
          target="_blank"
          rel="noopener noreferrer"
          className="footer-link"
        >
          GitHub
        </a>
        <span className="footer-sep" aria-hidden="true">·</span>
        <a
          href="https://github.com/mimanshugahlaut/autocorrect_tool#readme"
          target="_blank"
          rel="noopener noreferrer"
          className="footer-link"
        >
          Docs
        </a>
        <span className="footer-sep" aria-hidden="true">·</span>
        <a
          href="https://github.com/mimanshugahlaut/autocorrect_tool/blob/main/LICENSE"
          target="_blank"
          rel="noopener noreferrer"
          className="footer-link"
        >
          MIT License
        </a>
      </nav>
    </footer>
  );
}
