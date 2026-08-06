import { Facebook, Linkedin, Phone } from "lucide-react";

const PRODUCT_NAME = "Gas Transfer Calculator";

const textStyle: React.CSSProperties = {
  fontFamily: "Roboto, Helvetica, Arial, Lucida, sans-serif",
  fontSize: "14px",
  fontWeight: 500,
  lineHeight: "23.8px",
  color: "#020202",
  margin: 0,
};

const linkStyle: React.CSSProperties = { ...textStyle, textDecoration: "none" };

const iconLinkBase: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 3,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#ffffff",
  textDecoration: "none",
};

/** GMC footer: Italy + Canada contacts, social links, copyright and version bar. */
export const Footer = () => (
  <footer style={{ backgroundColor: "#ffffff" }}>
    <div className="container mx-auto px-4 py-10">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="text-center md:text-left space-y-1" style={textStyle}>
          <p style={textStyle}>Giovanni Malagnino Consulting</p>
          <p style={textStyle}>Italy</p>
          <p
            className="justify-center md:justify-start"
            style={{ ...textStyle, display: "flex", alignItems: "center", gap: 6 }}
          >
            <Phone size={14} aria-hidden="true" />
            <a href="tel:+393927290392" style={linkStyle}>
              +39 392 729 0392
            </a>
          </p>
          <p style={textStyle}>
            <a
              href="mailto:giovanni@giovannimalagninoconsulting.com"
              style={linkStyle}
              className="break-all"
            >
              giovanni@giovannimalagninoconsulting.com
            </a>
          </p>
        </div>

        <div className="text-center md:text-left space-y-1" style={textStyle}>
          <p style={textStyle}>&nbsp;</p>
          <p style={textStyle}>Canada</p>
          <p
            className="justify-center md:justify-start"
            style={{ ...textStyle, display: "flex", alignItems: "center", gap: 6 }}
          >
            <Phone size={14} aria-hidden="true" />
            <a href="tel:+14384480997" style={linkStyle}>
              +1 438 448 0997
            </a>
          </p>
        </div>

        <div className="flex items-start justify-center md:justify-end gap-2">
          <a
            href="https://www.facebook.com/giovannimalagninoconsulting"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Follow on Facebook"
            style={{ ...iconLinkBase, backgroundColor: "#3B5998" }}
          >
            <Facebook size={16} fill="#ffffff" strokeWidth={0} />
          </a>
          <a
            href="https://www.linkedin.com/in/giovannimalagnino/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Follow on LinkedIn"
            style={{ ...iconLinkBase, backgroundColor: "#007BB6" }}
          >
            <Linkedin size={16} fill="#ffffff" strokeWidth={0} />
          </a>
        </div>
      </div>

      {/* Copyright + version bar */}
      <div className="mt-6 pt-4 border-t border-border text-center space-y-1">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()}{" "}
          <a
            href="https://www.giovannimalagninoconsulting.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground transition-colors"
          >
            Giovanni Malagnino Consulting
          </a>{" "}
          — {PRODUCT_NAME} — All rights reserved.
        </p>
        <p className="text-[10px] text-muted-foreground">v20260806010300</p>
      </div>
    </div>
  </footer>
);

export default Footer;
