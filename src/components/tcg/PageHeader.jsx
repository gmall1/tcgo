import React from "react";
import { ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function PageHeader({ title, subtitle, backLink, rightAction }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        {backLink && (
          <Link to={backLink} className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center hover:bg-muted transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
        )}
        <div>
          <h1 className="font-display text-xl font-bold tracking-wide">{title}</h1>
          {subtitle && <p className="text-muted-foreground text-sm font-body">{subtitle}</p>}
        </div>
      </div>
      {rightAction}
    </div>
  );
}