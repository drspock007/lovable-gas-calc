import { Link, useLocation } from "react-router-dom";
import { Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import ThemeToggle from "@/components/ThemeToggle";
import Footer from "@/components/Footer";
import logo from "@/assets/logo.png";

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { path: "/", label: "Calculator", icon: Calculator },
];

/** Shared GMC header (logo + tagline + nav + theme toggle) and footer. */
export const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-background font-['Inter',sans-serif]">
      <header className="border-b border-border bg-card shadow-sm">
        <div className="container mx-auto px-4">
          {/* Top band: logo (left) + tagline (right) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center py-6">
            <div className="flex justify-center md:justify-start">
              <a
                href="https://giovannimalagninoconsulting.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block"
              >
                <img
                  src={logo}
                  alt="Giovanni Malagnino Consulting"
                  className="h-16 md:h-24 w-auto hover:opacity-80 transition-opacity"
                  width={512}
                  height={512}
                />
              </a>
            </div>
            <div
              className="text-center md:text-left text-foreground"
              style={{
                fontFamily: '"Habibi", Georgia, "Times New Roman", serif',
                fontSize: "27px",
                fontWeight: 500,
                letterSpacing: "2px",
                lineHeight: "1.7em",
                margin: 0,
                padding: "0 0 1em 0",
              }}
            >
              <p>Engineering</p>
              <p>Consulting</p>
              <p>Project management</p>
            </div>
          </div>

          {/* Navigation row */}
          <nav className="flex flex-wrap items-center gap-1 justify-center md:justify-end pb-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-label={item.label}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-md transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary hover:text-secondary-foreground",
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
            <div className="ml-2">
              <ThemeToggle />
            </div>
          </nav>
        </div>
      </header>

      <main className="container mx-auto flex-1 px-4 py-8">{children}</main>
      <Footer />
    </div>
  );
};

export default Layout;
