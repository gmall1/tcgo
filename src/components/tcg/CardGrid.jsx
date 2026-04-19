import React from "react";
import CardDisplay from "./CardDisplay";

export default function CardGrid({ cards, onCardClick, selectedCards = [], size = "md" }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
      {cards.map((card) => (
        <CardDisplay
          key={card.id}
          card={card}
          size={size}
          onClick={onCardClick}
          selected={selectedCards.includes(card.id)}
        />
      ))}
    </div>
  );
}