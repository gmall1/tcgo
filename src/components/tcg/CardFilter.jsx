import React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, SlidersHorizontal } from "lucide-react";

export default function CardFilter({ search, onSearchChange, typeFilter, onTypeChange, cardTypeFilter, onCardTypeChange }) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search cards..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 bg-secondary border-border font-body"
        />
      </div>
      <Select value={cardTypeFilter} onValueChange={onCardTypeChange}>
        <SelectTrigger className="w-full sm:w-36 bg-secondary border-border font-body">
          <SelectValue placeholder="Card Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          <SelectItem value="pokemon">Pokémon</SelectItem>
          <SelectItem value="trainer">Trainer</SelectItem>
          <SelectItem value="energy">Energy</SelectItem>
        </SelectContent>
      </Select>
      <Select value={typeFilter} onValueChange={onTypeChange}>
        <SelectTrigger className="w-full sm:w-36 bg-secondary border-border font-body">
          <SlidersHorizontal className="w-4 h-4 mr-2" />
          <SelectValue placeholder="Energy" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Energy</SelectItem>
          <SelectItem value="fire">Fire</SelectItem>
          <SelectItem value="water">Water</SelectItem>
          <SelectItem value="grass">Grass</SelectItem>
          <SelectItem value="electric">Electric</SelectItem>
          <SelectItem value="psychic">Psychic</SelectItem>
          <SelectItem value="fighting">Fighting</SelectItem>
          <SelectItem value="dark">Dark</SelectItem>
          <SelectItem value="steel">Steel</SelectItem>
          <SelectItem value="dragon">Dragon</SelectItem>
          <SelectItem value="colorless">Colorless</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}