import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function PageNotFound() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-5">
      <div className="max-w-lg w-full rounded-3xl border border-border bg-card p-8 text-center space-y-4">
        <div className="text-5xl">🧭</div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-body">Route not found</p>
        <h1 className="font-display text-3xl font-bold">404</h1>
        <p className="text-sm font-body text-muted-foreground">
          The page <span className="font-semibold text-foreground">{location.pathname}</span> is not part of the rebuilt local app.
        </p>
        <Link to="/">
          <Button className="font-body">Go Home</Button>
        </Link>
      </div>
    </div>
  );
}
