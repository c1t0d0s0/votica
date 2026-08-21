import React, { useState, useMemo } from "react";
import {
  X,
  Search,
  Scale,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Package,
  Layers,
  Wrench,
} from "lucide-react";
import { OSS_LICENSES, OssPackageLicense } from "../../data/ossLicenses";
import { useTranslation } from "../../contexts/LanguageContext";

interface OssLicensesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = "all" | "prod" | "dev";

export const OssLicensesModal: React.FC<OssLicensesModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [expandedPackages, setExpandedPackages] = useState<Record<string, boolean>>({});
  const [copiedPackage, setCopiedPackage] = useState<string | null>(null);

  // Close on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Reset search and tab on modal open
  React.useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setActiveTab("all");
      setCopiedPackage(null);
    }
  }, [isOpen]);

  const toggleExpand = (name: string) => {
    setExpandedPackages((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  const handleCopyLicense = async (pkg: OssPackageLicense) => {
    const textToCopy = `Package: ${pkg.name} (v${pkg.version})\nLicense: ${pkg.license}\n${pkg.copyright}\nRepository: ${pkg.repository}\n\n${pkg.licenseText}`;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedPackage(pkg.name);
      setTimeout(() => {
        setCopiedPackage((current) => (current === pkg.name ? null : current));
      }, 2000);
    } catch {
      // Fallback
    }
  };

  const prodCount = useMemo(() => OSS_LICENSES.filter((p) => !p.isDev).length, []);
  const devCount = useMemo(() => OSS_LICENSES.filter((p) => p.isDev).length, []);

  const filteredLicenses = useMemo(() => {
    return OSS_LICENSES.filter((item) => {
      // Filter by tab
      if (activeTab === "prod" && item.isDev) return false;
      if (activeTab === "dev" && !item.isDev) return false;

      // Filter by search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.license.toLowerCase().includes(q) ||
        item.copyright.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      );
    });
  }, [activeTab, searchQuery]);

  if (!isOpen) return null;

  const getLicenseBadgeColor = (license: string) => {
    const l = license.toLowerCase();
    if (l.includes("mit")) {
      return "bg-blue-50 text-blue-700 border-blue-200";
    }
    if (l.includes("apache")) {
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }
    if (l.includes("isc") || l.includes("bsd")) {
      return "bg-purple-50 text-purple-700 border-purple-200";
    }
    return "bg-slate-50 text-slate-700 border-slate-200";
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* Dialog Container */}
      <div className="flex min-h-full items-center justify-center p-3 sm:p-6 text-center">
        <div className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl transition-all w-full max-w-4xl max-h-[90vh] flex flex-col animate-slide-up border border-slate-100">
          {/* Modal Header */}
          <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-start justify-between gap-4 bg-slate-50/50">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex-shrink-0 mt-0.5">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 leading-snug">
                  {t("ossModal.title")}
                </h3>
                <p className="text-xs text-slate-500 mt-1">{t("ossModal.desc")}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0"
              aria-label={t("common.close")}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Controls: Search & Tabs */}
          <div className="p-4 sm:px-6 border-b border-slate-100 bg-white flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("ossModal.searchPlaceholder")}
                className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800 placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-start sm:self-auto text-xs font-medium text-slate-600">
              <button
                onClick={() => setActiveTab("all")}
                className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                  activeTab === "all"
                    ? "bg-white text-indigo-600 shadow-sm font-semibold"
                    : "hover:text-slate-900"
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>{t("ossModal.tabAll", { count: OSS_LICENSES.length })}</span>
              </button>
              <button
                onClick={() => setActiveTab("prod")}
                className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                  activeTab === "prod"
                    ? "bg-white text-indigo-600 shadow-sm font-semibold"
                    : "hover:text-slate-900"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{t("ossModal.tabDependencies", { count: prodCount })}</span>
              </button>
              <button
                onClick={() => setActiveTab("dev")}
                className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                  activeTab === "dev"
                    ? "bg-white text-indigo-600 shadow-sm font-semibold"
                    : "hover:text-slate-900"
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>{t("ossModal.tabDevDependencies", { count: devCount })}</span>
              </button>
            </div>
          </div>

          {/* Modal Body: Package List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 divide-y divide-slate-100">
            {filteredLicenses.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium">{t("ossModal.noResults")}</p>
              </div>
            ) : (
              filteredLicenses.map((pkg) => {
                const isExpanded = !!expandedPackages[pkg.name];
                const isCopied = copiedPackage === pkg.name;

                return (
                  <div
                    key={pkg.name}
                    className="pt-3 first:pt-0 bg-white rounded-xl transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 font-mono">
                          {pkg.name}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono font-medium">
                          v{pkg.version}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-md font-medium border ${getLicenseBadgeColor(
                            pkg.license
                          )}`}
                        >
                          {pkg.license}
                        </span>
                        {pkg.isDev && (
                          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">
                            dev
                          </span>
                        )}
                      </div>

                      {/* Links */}
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        {pkg.repository && (
                          <a
                            href={pkg.repository}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 hover:text-indigo-600 transition-colors"
                          >
                            <span>{t("ossModal.viewRepository")}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        <a
                          href={`https://www.npmjs.com/package/${pkg.name}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 hover:text-indigo-600 transition-colors"
                        >
                          <span>{t("ossModal.viewNpm")}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>

                    {/* Description & Copyright */}
                    <div className="mt-1.5 space-y-1">
                      {pkg.description && (
                        <p className="text-xs text-slate-600 line-clamp-2">{pkg.description}</p>
                      )}
                      <p className="text-xs text-slate-500 font-mono flex items-center gap-1">
                        <span className="text-slate-400 font-sans">{t("ossModal.copyright")}:</span>
                        <span>{pkg.copyright}</span>
                      </p>
                    </div>

                    {/* Expand License Text Button */}
                    <div className="mt-2.5 flex items-center gap-2">
                      <button
                        onClick={() => toggleExpand(pkg.name)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50/60 hover:bg-indigo-50 px-2.5 py-1 rounded-md transition-colors"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="w-3.5 h-3.5" />
                            <span>{t("ossModal.hideLicense")}</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3.5 h-3.5" />
                            <span>{t("ossModal.showLicense")}</span>
                          </>
                        )}
                      </button>

                      {isExpanded && (
                        <button
                          onClick={() => handleCopyLicense(pkg)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-md transition-colors"
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700">{t("ossModal.copied")}</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-slate-400" />
                              <span>{t("ossModal.copyLicense")}</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Full License Text Box */}
                    {isExpanded && (
                      <div className="mt-3 p-3.5 bg-slate-900 text-slate-200 rounded-lg text-xs font-mono whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed border border-slate-800 animate-fade-in shadow-inner">
                        {pkg.licenseText}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
            <span>
              {t("common.appName")} &copy; {new Date().getFullYear()}
            </span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-medium transition-colors shadow-sm"
            >
              {t("common.close")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
